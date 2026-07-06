import React, { useState } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie
} from "recharts";
import "./Dashboard.css"; 


function Dashboard() {
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatting, setIsChatting] = useState(false);
  const [targetHandle, setTargetHandle] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function fetchUserStats(event) {
    event.preventDefault(); 
    if (!targetHandle) return;

    setIsLoading(true);
    setErrorMessage("");
    setDashboardData(null);

    try {
      const response = await fetch(`http://localhost:3000/api/user/${targetHandle}`);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to fetch data");
      }

      setDashboardData(responseData);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
    
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    if (!chatMessage.trim() || !dashboardData) return;

    const userText = chatMessage;
    // Add user message to UI immediately
    setChatHistory(prev => [...prev, { sender: "user", text: userText }]);
    setChatMessage("");
    setIsChatting(true);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: dashboardData.handle, message: userText })
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error);

      // Add AI reply to UI
      setChatHistory(prev => [...prev, { sender: "ai", text: data.reply }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { sender: "ai", text: "Sorry, I lost my connection to the server." }]);
    } finally {
      setIsChatting(false);
    }
  }

  // Prep data for accuracy donut chart if stats exist
  const getAccuracyData = () => {
    if (!dashboardData) return [];
    const solved = dashboardData.metrics.totalSolved;
    const total = dashboardData.metrics.totalSubmissions;
    const failed = Math.max(0, total - solved);
    return [
      { name: "Solved Submissions", value: solved, color: "#2e7d32" },
      { name: "Incorrect/Other", value: failed, color: "#cfd8dc" }
    ];
  };

  return (
    <div className="dash-container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ textAlign: "center", color: "#0f172a", margin: "0 0 2rem 0" }}>CP Analytics Engine</h1>
      
      <form onSubmit={fetchUserStats} className="search-form" style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "2rem" }}>
        <input 
          type="text"
          placeholder="Codeforces Handle" 
          value={targetHandle}
          onChange={(event) => setTargetHandle(event.target.value)}
          className="search-input"
          style={{ padding: "0.75rem 1rem", fontSize: "1rem", borderRadius: "6px", border: "1px solid #cbd5e1", width: "300px" }}
        />
        <button 
          type="submit" 
          disabled={isLoading} 
          className="search-btn"
          style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", borderRadius: "6px", border: "none", backgroundColor: "#1e40af", color: "white", cursor: "pointer" }}
        >
          {isLoading ? "Analyzing..." : "Analyze"}
        </button>
      </form>

      {errorMessage && <p className="error-msg" style={{ color: "#dc2626", textAlign: "center" }}>Error: {errorMessage}</p>}

      {dashboardData && (
        <div className="results-card" style={{ backgroundColor: "#f8fafc", padding: "2rem", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)" }}>
          <h2 style={{ color: "#1e293b", borderBottom: "2px solid #e2e8f0", paddingBottom: "0.5rem", marginTop: 0 }}>Stats for {dashboardData.handle}</h2>
          
          {/* 1. Summary Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", margin: "1.5rem 0" }}>
            <div style={{ backgroundColor: "white", padding: "1rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Total Solved</span>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.25rem 0 0 0", color: "#0f172a" }}>{dashboardData.metrics.totalSolved} / {dashboardData.metrics.totalSubmissions}</p>
            </div>
            <div style={{ backgroundColor: "white", padding: "1rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Accuracy Rate</span>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.25rem 0 0 0", color: "#2e7d32" }}>{dashboardData.metrics.accuracyRate}</p>
            </div>
            <div style={{ backgroundColor: "white", padding: "1rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Comfort Zone Rating</span>
              <p style={{ fontSize: "1.5rem", fontWeight: "bold", margin: "0.25rem 0 0 0", color: "#1e40af" }}>{dashboardData.metrics.comfortZoneRating}</p>
            </div>
          </div>

          {/* 2. DANGER ZONE BLOCK */}
          {dashboardData.metrics.dangerTags && dashboardData.metrics.dangerTags.length > 0 && (
            <div style={{ backgroundColor: "#fff5f5", padding: "1.25rem", borderRadius: "8px", margin: "1.5rem 0", borderLeft: "5px solid #ef4444", textAlign: "left" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#991b1b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>⚠️</span> High-Penalty Risk Areas
              </h4>
              <p style={{ margin: "0 0 1rem 0", color: "#7f1d1d", fontSize: "0.9rem" }}>
                The engine detected high volumes of unsuccessful attempts on these specific tags. Watch your accuracy here to avoid heavy rating drops during live contests:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {dashboardData.metrics.dangerTags.map((tag, index) => (
                  <span key={index} style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "0.4rem 0.8rem", borderRadius: "6px", fontSize: "0.85rem", fontWeight: "600", border: "1px solid #fca5a5", textTransform: "capitalize" }}>
                    {tag.name}: {tag.wrong_count} failed attempts
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. Main Analytics Layout Visuals (Charts) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", margin: "2rem 0" }}>
            
            {/* Visual 1: Skill Distribution Radar Chart */}
            <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <h4 style={{ margin: "0 0 1rem 0", color: "#334155", textAlign: "center" }}>Current Topic Strength</h4>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <RadarChart cx="50%" cy="50%" radius="70%" data={dashboardData.metrics.topTags}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10 }} />
                    <Radar name="Solved" dataKey="count" stroke="#1e40af" fill="#3b82f6" fillOpacity={0.4} />
                    <Tooltip contentStyle={{ borderRadius: '6px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visual 2: Accuracy Ring Donut Chart */}
            <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <h4 style={{ margin: "0 0 1rem 0", color: "#334155", textAlign: "center" }}>Submission Breakdown</h4>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={getAccuracyData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {getAccuracyData().map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Submissions`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 4. AI Coach Blueprint Block */}
          <div style={{ backgroundColor: "#eff6ff", padding: "1.5rem", borderRadius: "8px", margin: "1.5rem 0", borderLeft: "5px solid #2563eb" }}>
            <h3 style={{ margin: "0 0 1.5rem 0", color: "#1e3a8a", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🤖</span> AI Coach Target Pathway
            </h3>
            
            {dashboardData.ai_coach && dashboardData.ai_coach.recommendations ? (
              <div>
                {/* Visual 3: Projected Gain Bar Chart */}
                <div style={{ backgroundColor: "white", padding: "1.5rem", borderRadius: "8px", marginBottom: "1.5rem", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  <h4 style={{ margin: "0 0 1rem 0", color: "#334155" }}>Projected Rating Jumps per Target Topic</h4>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart 
                        data={dashboardData.ai_coach.recommendations}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" hide={true} />
                        <YAxis dataKey="topic" type="category" width={100} tick={{ fill: '#475569', fontSize: 13 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: 'transparent' }}
                          formatter={(value) => [`+${value} Points`, 'Potential Gain']}
                          contentStyle={{ borderRadius: '6px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="predicted_rating_jump" radius={[0, 4, 4, 0]} barSize={24}>
                          {dashboardData.ai_coach.recommendations.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#1d4ed8" : "#60a5fa"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recommendations Details List */}
                <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
                  {dashboardData.ai_coach.recommendations.map((recommendation, index) => (
                    <li key={index} style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: index !== dashboardData.ai_coach.recommendations.length - 1 ? "1px solid #dbeafe" : "none" }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#1e3a8a", marginBottom: "0.3rem" }}>
                        {index + 1}. {recommendation.topic}
                      </div>
                      <div style={{ fontSize: "0.95rem", color: "#15803d", fontWeight: "500" }}>
                        ↑ Predicted Jump: +{recommendation.predicted_rating_jump} points
                      </div>
                      <div style={{ fontSize: "0.95rem", color: "#c2410c", fontWeight: "500" }}>
                        🎯 Target Difficulty: {recommendation.target_difficulty}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ margin: 0, fontStyle: "italic", color: "#64748b" }}>Calculating optimal path...</p>
            )}
          </div>

          {/* 5. Top Tags Table Summary */}
          <h3 style={{ color: "#334155", marginTop: "2rem" }}>Top Tags Table Summary:</h3>
          <ul className="tag-list" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyleType: "none", padding: 0 }}>
            {dashboardData.metrics.topTags.map((tag, index) => (
              <li key={index} className="tag-item" style={{ backgroundColor: "#f1f5f9", color: "#334155", padding: "0.5rem 1rem", borderRadius: "20px", fontSize: "0.9rem", fontWeight: "500" }}>
                {tag.name}: <strong>{tag.count}</strong> solved
              </li>
            ))}
          </ul>
          {/* 6. LANGGRAPH AI CHAT INTERFACE */}
          <div className="chat-container">
            <h3 className="chat-title">💬 Ask the AI Coach</h3>
            <div className="chat-history">
              {chatHistory.length === 0 ? (
                <p className="chat-empty">Ask a question about {dashboardData.handle}'s performance, weaknesses, or contest strategy!</p>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`chat-bubble ${msg.sender === "ai" ? "chat-ai" : "chat-user"}`}>
                    <strong>{msg.sender === "ai" ? "🤖 AI Coach:" : "👤 You:"}</strong> 
                    <div style={{marginTop: "4px", whiteSpace: "pre-line"}}>{msg.text}</div>
                  </div>
                ))
              )}
              {isChatting && <div className="chat-bubble chat-ai"><em>🤖 AI is thinking...</em></div>}
            </div>
            
            <form onSubmit={handleChatSubmit} className="chat-input-form">
              <input 
                type="text" 
                value={chatMessage} 
                onChange={(e) => setChatMessage(e.target.value)} 
                placeholder={`Ask about ${dashboardData.handle}'s stats...`}
                className="chat-input"
                disabled={isChatting}
              />
              <button type="submit" disabled={isChatting || !chatMessage.trim()} className="chat-send-btn">
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;