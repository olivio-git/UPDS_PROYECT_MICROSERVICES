import { Request, Response, NextFunction } from 'express';
import { QuestionService } from '../services/question.service';
import { StorageService } from '../services/storage.service';
import { logger } from '../utils/logger';

export class MediaController {
  private questionService: QuestionService;
  private storageService: StorageService;

  constructor() {
    this.questionService = new QuestionService();
    this.storageService = new StorageService();
  }

  // Stream audio file directly
  streamAudio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionId } = req.params;
      
      // Get question to find the audio file key
      const question = await this.questionService.findById(questionId!);
      
      if (!question || !question.content.mediaUrl) {
        res.status(404).json({
          success: false,
          message: 'Audio no encontrado'
        });
        return;
      }

      // Extract the object key from the URL or store it separately
      // For now, we'll get it from the mediaUrl
      const urlParts = question.content.mediaUrl.split('/');
      const objectKey = urlParts.slice(-3).join('/'); // Adjust based on your URL structure
      
      // Get the audio stream
      const stream = await this.storageService.getFileStream(objectKey);
      
      // Set appropriate headers
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      
      // Pipe the stream to response
      stream.pipe(res);
    } catch (error) {
      logger.error('Error streaming audio:', error);
      next(error);
    }
  };

  // Get a fresh presigned URL
  getPresignedUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionId } = req.params;
      const { expiry = 3600 } = req.query; // Default 1 hour
      
      const question = await this.questionService.findById(questionId!);
      
      if (!question || !question.content.mediaUrl) {
        res.status(404).json({
          success: false,
          message: 'Media no encontrado'
        });
        return;
      }

      // Extract object key from stored URL
      const urlParts = question.content.mediaUrl.split('/');
      const objectKey = `questions/${questionId}/audio/${urlParts[urlParts.length - 1]}`;
      
      // Generate new presigned URL with custom expiry
      const url = await this.storageService.getFileUrl(objectKey, Number(expiry));
      
      res.json({
        success: true,
        data: {
          url,
          expiresIn: Number(expiry),
          contentType: 'audio/mpeg'
        }
      });
    } catch (error) {
      logger.error('Error getting presigned URL:', error);
      next(error);
    }
  };

  // Get permanent public URL (if bucket is public)
  getPublicUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionId } = req.params;
      
      const question = await this.questionService.findById(questionId!);
      
      if (!question || !question.content.mediaUrl) {
        res.status(404).json({
          success: false,
          message: 'Media no encontrado'
        });
        return;
      }

      // For public access, you need to configure MinIO bucket policy
      const publicUrl = `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKET_NAME}/questions/${questionId}/audio/`;
      
      res.json({
        success: true,
        data: {
          url: publicUrl,
          permanent: true,
          note: 'This URL requires public bucket configuration'
        }
      });
    } catch (error) {
      logger.error('Error getting public URL:', error);
      next(error);
    }
  };

  // Test audio playback with metadata
  testAudioPlayback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionId } = req.params;
      
      const question = await this.questionService.findById(questionId!);
      
      if (!question || !question.content.mediaUrl) {
        res.status(404).json({
          success: false,
          message: 'Audio no encontrado'
        });
        return;
      }

      // Generate a test page with audio player
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Audio Test - Question ${questionId}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 { color: #333; }
            .question-info {
              background: #f0f0f0;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
            }
            audio {
              width: 100%;
              margin: 20px 0;
            }
            .controls {
              display: flex;
              gap: 10px;
              margin-top: 20px;
            }
            button {
              padding: 10px 20px;
              background: #007bff;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
            button:hover {
              background: #0056b3;
            }
            .status {
              margin-top: 20px;
              padding: 10px;
              border-radius: 4px;
              display: none;
            }
            .status.success {
              background: #d4edda;
              color: #155724;
              display: block;
            }
            .status.error {
              background: #f8d7da;
              color: #721c24;
              display: block;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎵 Audio Test Player</h1>
            
            <div class="question-info">
              <h3>Question Details:</h3>
              <p><strong>ID:</strong> ${questionId}</p>
              <p><strong>Type:</strong> ${question.type}</p>
              <p><strong>Level:</strong> ${question.level}</p>
              <p><strong>Competency:</strong> ${question.competency}</p>
              <p><strong>Question:</strong> ${question.content.question}</p>
            </div>

            <h3>Audio Player:</h3>
            <audio controls id="audioPlayer">
              <source src="${question.content.mediaUrl}" type="audio/mpeg">
              <source src="${question.content.mediaUrl}" type="audio/wav">
              Your browser does not support the audio element.
            </audio>

            <div class="controls">
              <button onclick="playAudio()">▶️ Play</button>
              <button onclick="pauseAudio()">⏸️ Pause</button>
              <button onclick="reloadAudio()">🔄 Reload</button>
              <button onclick="downloadAudio()">💾 Download</button>
            </div>

            <div id="status" class="status"></div>

            <script>
              const audio = document.getElementById('audioPlayer');
              const status = document.getElementById('status');

              audio.addEventListener('loadedmetadata', function() {
                showStatus('Audio loaded successfully. Duration: ' + audio.duration.toFixed(2) + ' seconds', 'success');
              });

              audio.addEventListener('error', function(e) {
                showStatus('Error loading audio: ' + e.message, 'error');
              });

              function playAudio() {
                audio.play();
                showStatus('Playing audio...', 'success');
              }

              function pauseAudio() {
                audio.pause();
                showStatus('Audio paused', 'success');
              }

              function reloadAudio() {
                audio.load();
                showStatus('Reloading audio...', 'success');
              }

              function downloadAudio() {
                const a = document.createElement('a');
                a.href = audio.src;
                a.download = 'question_${questionId}_audio.mp3';
                a.click();
                showStatus('Downloading audio...', 'success');
              }

              function showStatus(message, type) {
                status.textContent = message;
                status.className = 'status ' + type;
                setTimeout(() => {
                  status.className = 'status';
                }, 5000);
              }
            </script>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      logger.error('Error in audio test playback:', error);
      next(error);
    }
  };
}

export const mediaController = new MediaController();