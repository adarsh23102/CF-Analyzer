import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(cors());

app.get('/api/user/:handle', async (request, response) => {
    try {
        const targetHandle = request.params.handle;
        console.log(`Processing data for: ${targetHandle}`);
        
        // 1. Fetch Codeforces Data
        const codeforcesUrl = `https://codeforces.com/api/user.status?handle=${targetHandle}`;
        const codeforcesResponse = await fetch(codeforcesUrl);
        const codeforcesData = await codeforcesResponse.json();
        
        if (codeforcesData.status !== "OK") {
            return response.status(400).json({ error: codeforcesData.comment || "User not found" });
        }

        const submissions = codeforcesData.result;
        let totalSubmissions = submissions.length;
        let acceptedCount = 0;
        let ratingSum = 0;
        let ratedProblemCount = 0;
        
        const tagCounts = {};      // For successful solves
        const dangerTagCounts = {}; // NEW: For tracking wrong/failed attempts

        submissions.forEach(submission => {
            const tags = submission.problem.tags || [];
            
            if (submission.verdict === "OK") {
                // Handle Successful Solves
                acceptedCount++;
                if (submission.problem.rating) {
                    ratingSum += submission.problem.rating;
                    ratedProblemCount++;
                }
                tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            } else if (submission.verdict && submission.verdict !== "OK") {
                // NEW: Handle Failed Submissions (Wrong Answer, TLE, RE, etc.)
                tags.forEach(tag => {
                    dangerTagCounts[tag] = (dangerTagCounts[tag] || 0) + 1;
                });
            }
        });

        const comfortZoneRating = ratedProblemCount > 0 ? Math.round(ratingSum / ratedProblemCount) : 0;
        const accuracyRate = totalSubmissions > 0 ? ((acceptedCount / totalSubmissions) * 100).toFixed(2) : 0;
        
        // Sort and get Top 5 successful tags
        const topTags = Object.entries(tagCounts)
            .map(([tagName, count]) => ({ name: tagName, count: count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // NEW: Sort and get Top 3 highest penalty/danger tags
        const dangerTags = Object.entries(dangerTagCounts)
            .map(([tagName, count]) => ({ name: tagName, wrong_count: count }))
            .sort((a, b) => b.wrong_count - a.wrong_count)
            .slice(0, 3);

        // 2. Fetch from local AI Engine (FastAPI)
        const aiEngineUrl = `http://127.0.0.1:8000/recommend/${targetHandle}`;
        const aiResponse = await fetch(aiEngineUrl);
        
        if (!aiResponse.ok) {
            return response.status(500).json({ error: "AI backend error" });
        }
        
        const aiCoachData = await aiResponse.json();

        // 3. Send combined data to React frontend
        response.json({
            handle: targetHandle,
            metrics: {
                totalSubmissions: totalSubmissions,
                totalSolved: acceptedCount,
                accuracyRate: accuracyRate + "%",
                comfortZoneRating: comfortZoneRating,
                topTags: topTags,
                dangerTags: dangerTags // NEW: Transmitted to frontend
            },
            ai_coach: aiCoachData 
        });
        
    } catch (error) {
        console.error("Server Error:", error);
        response.status(500).json({ error: "Failed to process request" });
    }
});
// NEW: Chat Endpoint Proxy
app.post('/api/chat', async (request, response) => {
    try {
        const { handle, message } = request.body;
        
        // Forward the message to the Python FastAPI LangGraph Engine
        const aiEngineUrl = `http://127.0.0.1:8000/chat`;
        
        const fetchResponse = await fetch(aiEngineUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ handle: handle, msg: message })
        });

        if (!fetchResponse.ok) {
            return response.status(500).json({ error: "AI chat engine failed to respond." });
        }

        const chatData = await fetchResponse.json();
        response.json(chatData);

    } catch (error) {
        console.error("Chat Error:", error);
        response.status(500).json({ error: "Failed to process chat request" });
    }
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});