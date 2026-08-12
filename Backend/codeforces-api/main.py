from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import joblib
import pandas as pd
import requests
import uvicorn

# LangChain & LangGraph Imports
from langchain_core.tools import tool
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv

# Load the variables from the .env file into the active environment

# Fetch the specific variable you need
load_dotenv()
api_key = os.getenv("API_KEY")
# ==========================================
# 1. INITIALIZATION & DATA
# ==========================================
app = FastAPI(title="Codeforces AI Coach (Live Edition)")

print("Loading AI Model and Datasets...")
model = joblib.load('cf_recommender_xgboost.pkl')
feature_df = pd.read_pickle('cf_features_baseline.pkl')
original_df = pd.read_pickle('cf_original_data.pkl')

MODEL_FEATURES = feature_df.columns.tolist()
print("Server Ready!")

# ==========================================
# 2. LANGGRAPH AGENT SETUP
# ==========================================
# Make sure to replace this with your actual key
os.environ["GOOGLE_API_KEY"] = api_key
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.3)

@tool
def fetch_user_context(handle: str) -> str:
    """Fetches CP stats, strengths, and weaknesses for a user."""
    print(f"Agent looking up data for: {handle}")
    
    try:
        # 1. Use Cache if available, otherwise trigger the LIVE API fetcher!
        if handle in feature_df.index:
            u_data = feature_df.loc[handle]
        else:
            u_data, _ = fetch_live_user(handle)
    except Exception as e:
        return f"Failed to fetch live data for {handle}. Ensure the handle is correct."
    
    ctx = f"User: {handle}\n"
    
    s_tags = {}
    f_tags = {}
    
    # 2. Extract BOTH Solved (Strengths) and Failed (Weaknesses)
    for col in u_data.index:
        if col.endswith('_solved') and u_data[col] > 0:
            tag = col.replace('tag_', '').replace('_solved', '')
            s_tags[tag] = u_data[col]
        elif col.endswith('_failed') and u_data[col] > 0:
            tag = col.replace('tag_', '').replace('_failed', '')
            f_tags[tag] = u_data[col]
            
    top_solved = sorted(s_tags.items(), key=lambda x: x[1], reverse=True)[:10]
    top_failed = sorted(f_tags.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # 3. Format the data for the LLM's brain
    ctx += "\nTop Solved Topics (Strengths):\n"
    for t, c in top_solved:
        ctx += f"- {t.title()}: {c} solves\n"
        
    ctx += "\nMost Failed Topics (Weaknesses / High Penalty):\n"
    for t, c in top_failed:
        ctx += f"- {t.title()}: {c} failed attempts\n"
        
    return ctx

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]

tools = [fetch_user_context]
llm_w_tools = llm.bind_tools(tools)

def chat_node(state: AgentState):
    sys_pmpt = (
        "You are a competitive programming coach. "
        "Always use the provided tool to fetch user data before giving advice. "
        "Be concise, encouraging, and highly focused on algorithms."
    )
    msgs = [{"role": "system", "content": sys_pmpt}] + state["messages"]
    resp = llm_w_tools.invoke(msgs)
    return {"messages": [resp]}

gb = StateGraph(AgentState)
gb.add_node("bot", chat_node)
gb.add_node("tools", ToolNode(tools=tools))

gb.add_edge(START, "bot")
gb.add_conditional_edges("bot", tools_condition)
gb.add_edge("tools", "bot")

agent_app = gb.compile()

class RecommendReq(BaseModel):
    handle: str
    current_rating: int
    submissions: list

# ==========================================
# 3. EXISTING ML PIPELINE & ENDPOINTS
# ==========================================
def fetch_live_user(handle: str):
    """
    Hits the live Codeforces API, downloads submission history, 
    and builds an XGBoost-compatible feature vector on the fly.
    """
    print(f"Fetching live data from Codeforces API for: {handle}")
    
    # 1. Fetch current rating
    info_resp = requests.get(f"https://codeforces.com/api/user.info?handles={handle}").json()
    if info_resp.get('status') != 'OK':
        raise HTTPException(status_code=404, detail="User not found on Codeforces.")
    
    # If a user is unrated, Codeforces omits the 'rating' field. We default to 800.
    current_rating = info_resp['result'][0].get('rating', 800)

    # 2. Fetch all submissions
    subs_resp = requests.get(f"https://codeforces.com/api/user.status?handle={handle}").json()
    if subs_resp.get('status') != 'OK':
        raise HTTPException(status_code=500, detail="Failed to fetch submission history.")
    
    submissions = subs_resp['result']
    
    # 3. Initialize a blank feature vector matching the model's exact expectations
    vector = {col: 0 for col in MODEL_FEATURES}
    r_sum = {}
    r_cnt = {}

    # 4. Parse the history
    for sub in submissions:
        verdict = sub.get('verdict')
        prob = sub.get('problem', {})
        tags = prob.get('tags', [])
        p_rating = prob.get('rating', 0)

        for t in tags:
            col_slv = f"tag_{t}_solved"
            col_fail = f"tag_{t}_failed"
            
            # We ONLY track tags that the model was trained on (ignoring advanced/noise tags)
            if col_slv in vector:
                if verdict == 'OK':
                    vector[col_slv] += 1
                    if p_rating > 0:
                        r_sum[t] = r_sum.get(t, 0) + p_rating
                        r_cnt[t] = r_cnt.get(t, 0) + 1
                else:
                    vector[col_fail] += 1

    # 5. Calculate averages
    for t, cnt in r_cnt.items():
        if cnt > 0:
            vector[f"tag_{t}_avg_rating"] = r_sum[t] // cnt

    return pd.Series(vector), int(current_rating)

def fetch_live_user(handle: str):
    """
    Used by the LangGraph chat tool to fetch data for users not in the offline database.
    """
    info_resp = requests.get(f"https://codeforces.com/api/user.info?handles={handle}").json()
    if info_resp.get('status') != 'OK':
        raise HTTPException(status_code=404, detail="User not found on Codeforces.")
    
    current_rating = info_resp['result'][0].get('rating', 800)
    
    subs_resp = requests.get(f"https://codeforces.com/api/user.status?handle={handle}").json()
    if subs_resp.get('status') != 'OK':
        raise HTTPException(status_code=500, detail="Failed to fetch submission history.")
        
    vector = process_live_user(handle, int(current_rating), subs_resp['result'])
    return vector, int(current_rating)

def process_live_user(handle: str, current_rating: int, submissions: list):
    """
    Processes submission history provided by the Node backend directly 
    without hitting the Codeforces API.
    """
    print(f"Processing data directly for: {handle}")
    vector = {col: 0 for col in MODEL_FEATURES}
    r_sum = {}
    r_cnt = {}

    for sub in submissions:
        verdict = sub.get('verdict')
        prob = sub.get('problem', {})
        tags = prob.get('tags', [])
        p_rating = prob.get('rating', 0)

        for t in tags:
            col_slv = f"tag_{t}_solved"
            col_fail = f"tag_{t}_failed"
            
            if col_slv in vector:
                if verdict == 'OK':
                    vector[col_slv] += 1
                    if p_rating > 0:
                        r_sum[t] = r_sum.get(t, 0) + p_rating
                        r_cnt[t] = r_cnt.get(t, 0) + 1
                else:
                    vector[col_fail] += 1

    for t, cnt in r_cnt.items():
        if cnt > 0:
            vector[f"tag_{t}_avg_rating"] = r_sum[t] // cnt

    return pd.Series(vector)

@app.post("/recommend")
def get_recommendations(req: RecommendReq):
    """
    API Endpoint: Serves cached data if available, or processes provided live data on the fly.
    """
    # Check if we have them in our offline database first (it's faster)
    if req.handle in feature_df.index:
        current_rating = int(original_df.loc[req.handle, 'current_rating'])
        user_vector = feature_df.loc[req.handle].copy()
    else:
        # Process the submissions passed from Node.js
        user_vector = process_live_user(req.handle, req.current_rating, req.submissions)
        current_rating = req.current_rating

    # 1. Base Prediction
    base_prediction = model.predict([user_vector])[0]

    # 2. Run the Simulations
    base_tags = set([c.split('_')[1] for c in MODEL_FEATURES if c.startswith('tag_')])
    potential_gains = {}

    for tag in base_tags:
        solved_col = f"tag_{tag}_solved"
        avg_col = f"tag_{tag}_avg_rating"

        if solved_col in user_vector and avg_col in user_vector:
            simulated_vector = user_vector.copy()
            simulated_vector[solved_col] += 10
            simulated_vector[avg_col] = int(max(simulated_vector[avg_col], base_prediction + 100))

            new_prediction = model.predict([simulated_vector])[0]
            gain = new_prediction - base_prediction

            if gain > 0:
                potential_gains[tag] = float(gain)

    # 3. Sort and format the response
    recommendations = sorted(potential_gains.items(), key=lambda x: x[1], reverse=True)[:5]
    
    response = []
    for tag, gain in recommendations:
        optimal_diff = int(max(current_rating, user_vector[f"tag_{tag}_avg_rating"]) + 150)
        optimal_diff = round(optimal_diff / 100) * 100
        optimal_diff = min(optimal_diff, current_rating + 300)

        response.append({
            "topic": tag.title(),
            "predicted_rating_jump": round(gain, 2),
            "target_difficulty": optimal_diff
        })

    return {
        "handle": req.handle,
        "current_rating": current_rating,
        "data_source": "cached" if req.handle in feature_df.index else "live_api",
        "recommendations": response
    }

# ==========================================
# 4. NEW CHAT ENDPOINT
# ==========================================
class ChatReq(BaseModel):
    handle: str
    msg: str

@app.post("/chat")
async def chat_with_coach(req: ChatReq):
    pmpt = f"[User Handle: {req.handle}] {req.msg}"
    inputs = {"messages": [("user", pmpt)]}
    
    res = agent_app.invoke(inputs)
    ans = res["messages"][-1].content
    
    return {
        "handle": req.handle,
        "reply": ans
    }