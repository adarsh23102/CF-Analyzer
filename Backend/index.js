import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(cors());

// Dynamic environment variables for production, with local fallbacks
const port = process.env.PORT || 3000;
const aiUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

app.get('/api/user/:handle', async (req, res) => {
    try {
        const h = req.params.handle;
        console.log(`Processing data for: ${h}`);
        
        // 1. Fetch Codeforces Data
        const cfUrl = `https://codeforces.com/api/user.status?handle=${h}`;
        const cfRes = await fetch(cfUrl);
        const cfData = await cfRes.json();
        
        if (cfData.status !== "OK") {
            return res.status(400).json({ error: cfData.comment || "User not found" });
        }

        const subs = cfData.result;
        let totSubs = subs.length;
        let acCount = 0;
        let rSum = 0;
        let rCount = 0;
        
        const tags = {};      
        const dTags = {}; 

        subs.forEach(s => {
            const t = s.problem.tags || [];
            
            if (s.verdict === "OK") {
                // Handle Successful Solves
                acCount++;
                if (s.problem.rating) {
                    rSum += s.problem.rating;
                    rCount++;
                }
                t.forEach(tag => {
                    tags[tag] = (tags[tag] || 0) + 1;
                });
            } else if (s.verdict && s.verdict !== "OK") {
                // Handle Failed Submissions
                t.forEach(tag => {
                    dTags[tag] = (dTags[tag] || 0) + 1;
                });
            }
        });

        const czRating = rCount > 0 ? Math.round(rSum / rCount) : 0;
        const acc = totSubs > 0 ? ((acCount / totSubs) * 100).toFixed(2) : 0;
        
        const top = Object.entries(tags)
            .map(([n, c]) => ({ name: n, count: c }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const danger = Object.entries(dTags)
            .map(([n, c]) => ({ name: n, wrong_count: c }))
            .sort((a, b) => b.wrong_count - a.wrong_count)
            .slice(0, 3);

        // 2. Fetch from local AI Engine (FastAPI) using env variable
        const aiReqUrl = `${aiUrl}/recommend/${h}`;
        const aiRes = await fetch(aiReqUrl);
        
        if (!aiRes.ok) {
            return res.status(500).json({ error: "AI backend error" });
        }
        
        const aiData = await aiRes.json();

        // 3. Send combined data to React frontend
        res.json({
            handle: h,
            metrics: {
                totalSubmissions: totSubs,
                totalSolved: acCount,
                accuracyRate: acc + "%",
                comfortZoneRating: czRating,
                topTags: top,
                dangerTags: danger 
            },
            ai_coach: aiData 
        });
        
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: "Failed to process request" });
    }
});

// Chat Endpoint Proxy
app.post('/api/chat', async (req, res) => {
    try {
        const { handle, message } = req.body;
        
        // Forward using env variable
        const aiReqUrl = `${aiUrl}/chat`;
        
        const fetchRes = await fetch(aiReqUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ handle: handle, msg: message })
        });

        if (!fetchRes.ok) {
            return res.status(500).json({ error: "AI chat engine failed to respond." });
        }

        const chatData = await fetchRes.json();
        res.json(chatData);

    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: "Failed to process chat request" });
    }
});

// Dynamic port assignment for Render
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});