// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Initialize the Express app
const app = express();
const PORT = 3000;

// Enable CORS
app.use(cors());

// Enable body parsing for JSON data
app.use(bodyParser.json());

// Define paths to the executables
const ytDlpPath = path.join(__dirname, 'bin', 'yt-dlp.exe');  // Executable for Windows
const ffmpegPath = path.join(__dirname, 'bin', 'ffmpeg.exe'); // Executable for Windows

// Serve the HTML file
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>YouTube Downloader</title>
            <style>
                body { font-family: Arial, sans-serif; }
                #message { margin-top: 10px; color: red; }
            </style>
        </head>
        <body>
            <h1>YouTube Downloader</h1>
            <input type="text" id="video-url" placeholder="Enter YouTube video URL..." />
            <button id="download-audio-btn">Download Audio (MP3)</button>
            <button id="download-video-btn">Download Video (MP4)</button>
            <div id="message"></div>
    
            <script>
                const PORT = ${PORT};
                document.getElementById('download-audio-btn').addEventListener('click', async function() {
                    const url = document.getElementById('video-url').value;
                    const messageDiv = document.getElementById('message');

                    if (!url) {
                        messageDiv.innerText = 'Please enter a URL.';
                        return;
                    }

                    try {
                        const response = await fetch(\`http://localhost:\${PORT}/api/download-audio\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url })
                        });

                        if (!response.ok) {
                            const errorResult = await response.json();
                            messageDiv.innerText = errorResult.error || 'An unexpected error occurred.';
                            return;
                        }

                        const result = await response.json();
                        messageDiv.innerText = 'Download started... Files: ' + result.files.join(', ');
                    } catch (error) {
                        console.error('Error during fetch:', error);
                        messageDiv.innerText = 'An error occurred during the fetch. Please check the console for details.';
                    }
                });

                document.getElementById('download-video-btn').addEventListener('click', async function() {
                    const url = document.getElementById('video-url').value;
                    const messageDiv = document.getElementById('message');

                    if (!url) {
                        messageDiv.innerText = 'Please enter a URL.';
                        return;
                    }

                    try {
                        const response = await fetch(\`http://localhost:\${PORT}/api/download-video\`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url })
                        });

                        if (!response.ok) {
                            const errorResult = await response.json();
                            messageDiv.innerText = errorResult.error || 'An unexpected error occurred.';
                            return;
                        }

                        const result = await response.json();
                        messageDiv.innerText = 'Download started... Files: ' + result.files.join(', ');
                    } catch (error) {
                        console.error('Error during fetch:', error);
                        messageDiv.innerText = 'An error occurred during the fetch. Please check the console for details.';
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Define a route to download audio from a YouTube video
app.post('/api/download-audio', async (req, res) => {
    const videoUrl = req.body.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL is required.' });
    }

    // Create the downloads directory if it doesn't exist
    const downloadsDir = path.join(__dirname, 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });

    // Command to download the audio using yt-dlp
    const outputFilePath = path.join(downloadsDir, '%(title)s.%(ext)s'); // Output pattern for yt-dlp
    const command = `"${ytDlpPath}" -x --audio-format mp3 -o "${outputFilePath}" "${videoUrl}"`;

    // Execute yt-dlp command
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`yt-dlp Error:\n${stderr}`);
            return res.status(500).json({ error: 'Failed to download audio.' });
        }

        // List downloaded files
        fs.readdir(downloadsDir, (err, files) => {
            if (err) return res.status(500).json({ error: 'Error reading files.' });

            // Find the first .mp3 file
            const downloadedFile = files.find(file => file.endsWith('.mp3'));

            if (!downloadedFile) {
                return res.status(500).json({ error: 'No .mp3 file found in downloads directory.' });
            }

            // Create the path to the downloaded file
            const downloadedFilePath = path.join(downloadsDir, downloadedFile);
            const processedFilePath = path.join(downloadsDir, 'processed_output.mp3'); // Path for processed output

            // Define FFmpeg command to apply effects
            const ffmpegCommand = `"${ffmpegPath}" -i "${downloadedFilePath}" -af "volume=2.0,atempo=1.5" "${processedFilePath}"`;

            // Execute FFmpeg command
            exec(ffmpegCommand, (ffmpegError, ffmpegStdout, ffmpegStderr) => {
                if (ffmpegError) {
                    console.error(`FFmpeg Error:\n${ffmpegStderr}`);
                    return res.status(500).json({ error: 'Failed to process audio with FFmpeg.' });
                }

                // List processed files including the processed one
                fs.readdir(downloadsDir, (finalErr, finalFiles) => {
                    if (finalErr) return res.status(500).json({ error: 'Error reading files.' });
                    res.json({
                        message: 'Audio downloaded and processed successfully.',
                        files: finalFiles.filter(file => file.endsWith('.mp3')) // List only mp3 files
                    });
                });
            });
        });
    });
});

// Define a route to download video from a YouTube video
app.post('/api/download-video', (req, res) => {
    const videoUrl = req.body.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'URL is required.' });
    }

    // Create the downloads directory if it doesn't exist
    const downloadsDir = path.join(__dirname, 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });

    // Command to download the video using yt-dlp
    const outputFilePath = path.join(downloadsDir, '%(title)s.%(ext)s'); // Output pattern for yt-dlp
    const command = `"${ytDlpPath}" -f mp4 -o "${outputFilePath}" "${videoUrl}"`;

    // Execute yt-dlp command
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`yt-dlp Error:\n${stderr}`);
            return res.status(500).json({ error: 'Failed to download video.' });
        }

        // List downloaded files
        fs.readdir(downloadsDir, (err, files) => {
            if (err) return res.status(500).json({ error: 'Error reading files.' });

            // Find the first .mp4 file
            const downloadedFile = files.find(file => file.endsWith('.mp4'));

            if (!downloadedFile) {
                return res.status(500).json({ error: 'No .mp4 file found in downloads directory.' });
            }

            // Create the path to the downloaded file
            const downloadedFilePath = path.join(downloadsDir, downloadedFile);

            res.json({
                message: 'Video downloaded successfully.',
                files: [downloadedFile] // List only the downloaded mp4 file
            });
        });
    });
});

// Start the server and handle port in use exception
const startServer = (port) => {
    app.listen(port, (err) => {
        if (err) {
            if (err.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use. Trying another port...`);
                startServer(port + 1); // Try another port
            } else {
                console.error(`Error starting server: ${err.message}`);
            }
            return;
        }
        console.log(`Server is running at http://localhost:${port}`);
    });
};

startServer(PORT); // Start the server with the initial port