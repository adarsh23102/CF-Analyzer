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
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://cf-analyzer-backend.onrender.com";

  async function fetchUserStats(event) {
    event.preventDefault(); 
    if (!targetHandle) return;

    setIsLoading(true);
    setErrorMessage("");
    setDashboardData(null);

    try {
      const response = await fetch(`${backendUrl}/api/user/${targetHandle}`);
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
      const response = await fetch(`${backendUrl}/api/chat`, {
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
      { name: "Solved Submissions", value: solved, color: "#a855f7" },
      { name: "Incorrect/Other", value: failed, color: "#27272a" }
    ];
  };

  /* ---- Shared dark tooltip style for Recharts ---- */
  const darkTooltipStyle = {
    backgroundColor: '#181824',
    border: '1px solid #a855f7',
    borderRadius: '10px',
    boxShadow: '0 0 20px rgba(168, 85, 247, 0.2)',
    color: '#f8fafc',
    fontSize: '0.875rem',
    padding: '8px 12px',
  };

  return (
    <div className="dash-container" style={{ padding: "2.5rem", maxWidth: "1200px", margin: "0 auto", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <h1 style={{ textAlign: "center", color: "#f8fafc", margin: "0 0 0.5rem 0", fontSize: "2.2rem", fontWeight: "800", letterSpacing: "-0.03em" }}>
        CP Analytics Engine
      </h1>
      <p style={{ textAlign: "center", color: "#a855f7", margin: "0 0 2.5rem 0", fontSize: "0.95rem", fontWeight: "500", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Deep Performance Intelligence
      </p>
      
      <form onSubmit={fetchUserStats} className="search-form" style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "2.5rem" }}>
        <input 
          type="text"
          placeholder="Enter Codeforces Handle…" 
          value={targetHandle}
          onChange={(event) => setTargetHandle(event.target.value)}
          className="search-input"
          style={{ padding: "0.85rem 1.2rem", fontSize: "1rem", borderRadius: "10px", border: "1px solid #27272a", width: "320px", backgroundColor: "#181824", color: "#f8fafc" }}
        />
        <button 
          type="submit" 
          disabled={isLoading} 
          className="search-btn"
          style={{ padding: "0.85rem 2rem", fontSize: "1rem", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #9333ea, #a855f7)", color: "white", cursor: "pointer", fontWeight: "700" }}
        >
          {isLoading ? "⏳ Analyzing…" : "⚡ Analyze"}
        </button>
      </form>

      {errorMessage && <p className="error-msg" style={{ color: "#f87171", textAlign: "center" }}>Error: {errorMessage}</p>}

      {dashboardData && (
        <div className="results-card" style={{ backgroundColor: "#121218", padding: "2rem", borderRadius: "16px", boxShadow: "0 0 40px rgba(168, 85, 247, 0.06), 0 8px 32px rgba(0,0,0,0.3)", border: "1px solid #27272a" }}>
          <h2 style={{ color: "#f8fafc", borderBottom: "1px solid #27272a", paddingBottom: "0.75rem", marginTop: 0, fontWeight: "700", fontSize: "1.4rem" }}>
            <span style={{ color: "#a855f7" }}>⟐</span> Stats for <span style={{ color: "#c084fc" }}>{dashboardData.handle}</span>
          </h2>
          
          {/* 1. Summary Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", margin: "1.5rem 0" }}>
            <div style={{ backgroundColor: "#181824", padding: "1.25rem", borderRadius: "12px", border: "1px solid #27272a", boxShadow: "0 0 20px rgba(168, 85, 247, 0.06)", transition: "all 0.3s", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "100%", background: "linear-gradient(180deg, #a855f7, #9333ea)" }} />
              <span style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "600" }}>Total Solved</span>
              <p style={{ fontSize: "1.65rem", fontWeight: "800", margin: "0.3rem 0 0 0", color: "#f8fafc" }}>{dashboardData.metrics.totalSolved} <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: "500" }}>/ {dashboardData.metrics.totalSubmissions}</span></p>
            </div>
            <div style={{ backgroundColor: "#181824", padding: "1.25rem", borderRadius: "12px", border: "1px solid #27272a", boxShadow: "0 0 20px rgba(168, 85, 247, 0.06)", transition: "all 0.3s", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "100%", background: "linear-gradient(180deg, #22c55e, #16a34a)" }} />
              <span style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "600" }}>Accuracy Rate</span>
              <p style={{ fontSize: "1.65rem", fontWeight: "800", margin: "0.3rem 0 0 0", color: "#4ade80" }}>{dashboardData.metrics.accuracyRate}</p>
            </div>
            <div style={{ backgroundColor: "#181824", padding: "1.25rem", borderRadius: "12px", border: "1px solid #27272a", boxShadow: "0 0 20px rgba(168, 85, 247, 0.06)", transition: "all 0.3s", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "100%", background: "linear-gradient(180deg, #c084fc, #a855f7)" }} />
              <span style={{ fontSize: "0.8rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "600" }}>Comfort Zone Rating</span>
              <p style={{ fontSize: "1.65rem", fontWeight: "800", margin: "0.3rem 0 0 0", color: "#c084fc" }}>{dashboardData.metrics.comfortZoneRating}</p>
            </div>
          </div>

          {/* 2. DANGER ZONE BLOCK */}
          {dashboardData.metrics.dangerTags && dashboardData.metrics.dangerTags.length > 0 && (
            <div style={{ backgroundColor: "#1f0505", padding: "1.4rem", borderRadius: "12px", margin: "1.5rem 0", borderLeft: "4px solid #f87171", textAlign: "left", border: "1px solid #7f1d1d", boxShadow: "0 0 20px rgba(248, 113, 113, 0.06)" }}>
              <h4 style={{ margin: "0 0 0.5rem 0", color: "#f87171", display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "700", fontSize: "1rem" }}>
                <span>⚠️</span> High-Penalty Risk Areas
              </h4>
              <p style={{ margin: "0 0 1rem 0", color: "#fca5a5", fontSize: "0.875rem", lineHeight: "1.6" }}>
                The engine detected high volumes of unsuccessful attempts on these specific tags. Watch your accuracy here to avoid heavy rating drops during live contests:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {dashboardData.metrics.dangerTags.map((tag, index) => (
                  <span key={index} style={{ backgroundColor: "#2a0a0a", color: "#f87171", padding: "0.45rem 0.9rem", borderRadius: "8px", fontSize: "0.82rem", fontWeight: "700", border: "1px solid #991b1b", textTransform: "capitalize", letterSpacing: "0.01em" }}>
                    {tag.name}: {tag.wrong_count} failed attempts
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. Main Analytics Layout Visuals (Charts) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", margin: "2rem 0" }}>
            
            {/* Visual 1: Skill Distribution Radar Chart */}
            <div style={{ backgroundColor: "#181824", padding: "1.5rem", borderRadius: "12px", border: "1px solid #27272a", boxShadow: "0 0 20px rgba(168, 85, 247, 0.06)" }}>
              <h4 style={{ margin: "0 0 1rem 0", color: "#e9d5ff", textAlign: "center", fontWeight: "700", fontSize: "0.95rem", letterSpacing: "0.02em" }}>Current Topic Strength</h4>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <RadarChart cx="50%" cy="50%" radius="70%" data={dashboardData.metrics.topTags}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#52525b' }} axisLine={false} />
                    <Radar name="Solved" dataKey="count" stroke="#a855f7" fill="url(#radarGradient)" fillOpacity={0.5} strokeWidth={2} />
                    <Tooltip contentStyle={darkTooltipStyle} />
                    <defs>
                      <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c084fc" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#9333ea" stopOpacity={0.15} />
                      </linearGradient>
                    </defs>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Visual 2: Accuracy Ring Donut Chart */}
            <div style={{ backgroundColor: "#181824", padding: "1.5rem", borderRadius: "12px", border: "1px solid #27272a", boxShadow: "0 0 20px rgba(168, 85, 247, 0.06)" }}>
              <h4 style={{ margin: "0 0 1rem 0", color: "#e9d5ff", textAlign: "center", fontWeight: "700", fontSize: "0.95rem", letterSpacing: "0.02em" }}>Submission Breakdown</h4>
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={getAccuracyData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {getAccuracyData().map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value} Submissions`]}
                      contentStyle={darkTooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 4. AI Coach Blueprint Block */}
          <div style={{ backgroundColor: "#0f0e26", padding: "1.75rem", borderRadius: "12px", margin: "1.5rem 0", border: "1px solid #1e1b4b", boxShadow: "0 0 25px rgba(168, 85, 247, 0.08)" }}>
            <h3 style={{ margin: "0 0 1.5rem 0", color: "#e9d5ff", display: "flex", alignItems: "center", gap: "0.6rem", fontWeight: "700", fontSize: "1.15rem" }}>
              <span style={{ fontSize: "1.3rem" }}>🤖</span> AI Coach Target Pathway
            </h3>
            
            {dashboardData.ai_coach && dashboardData.ai_coach.recommendations ? (
              <div>
                {/* Visual 3: Projected Gain Bar Chart */}
                <div style={{ backgroundColor: "#181824", padding: "1.5rem", borderRadius: "12px", marginBottom: "1.5rem", border: "1px solid #27272a", boxShadow: "0 0 15px rgba(168, 85, 247, 0.05)" }}>
                  <h4 style={{ margin: "0 0 1rem 0", color: "#c4b5fd", fontWeight: "700", fontSize: "0.95rem" }}>Projected Rating Jumps per Target Topic</h4>
                  <div style={{ width: "100%", height: 220 }}>
                    <ResponsiveContainer>
                      <BarChart 
                        data={dashboardData.ai_coach.recommendations}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" hide={true} />
                        <YAxis dataKey="topic" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(168, 85, 247, 0.05)' }}
                          formatter={(value) => [`+${value} Points`, 'Potential Gain']}
                          contentStyle={darkTooltipStyle}
                        />
                        <Bar dataKey="predicted_rating_jump" radius={[0, 6, 6, 0]} barSize={26}>
                          {dashboardData.ai_coach.recommendations.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "#a855f7" : "#7c3aed"} />
                          ))}
                          <defs>
                            <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#9333ea" />
                              <stop offset="100%" stopColor="#c084fc" />
                            </linearGradient>
                          </defs>
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recommendations Details List */}
                <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
                  {dashboardData.ai_coach.recommendations.map((recommendation, index) => (
                    <li key={index} style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: index !== dashboardData.ai_coach.recommendations.length - 1 ? "1px solid #1e1b4b" : "none" }}>
                      <div style={{ fontSize: "1.05rem", fontWeight: "700", color: "#e9d5ff", marginBottom: "0.35rem" }}>
                        {index + 1}. {recommendation.topic}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#4ade80", fontWeight: "600" }}>
                        ↑ Predicted Jump: +{recommendation.predicted_rating_jump} points
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#fb923c", fontWeight: "600" }}>
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
          <h3 style={{ color: "#e9d5ff", marginTop: "2rem", fontWeight: "700", fontSize: "1.05rem" }}>Top Tags Table Summary:</h3>
          <ul className="tag-list" style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", listStyleType: "none", padding: 0 }}>
            {dashboardData.metrics.topTags.map((tag, index) => (
              <li key={index} className="tag-item" style={{ backgroundColor: "#181824", color: "#c4b5fd", padding: "0.55rem 1.1rem", borderRadius: "20px", fontSize: "0.875rem", fontWeight: "500", border: "1px solid #27272a" }}>
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