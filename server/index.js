import express from "express"
import cors from 'cors'
import multer from "multer"
import { v4 as uuid4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { execSync, exec } from "child_process"

const app = express()
// multer middleware

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = uuid4() + path.extname(file.originalname)
        cb(null, file.fieldname + '-' + uniqueSuffix)
    }
})

const upload = multer({ storage: storage })

app.use(cors({
    origin: ["http://localhost:3000"]
}));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.get('/', function (req, res) {
    res.json('ok');
});

class VideoHandler {

    static getVideoResolution(videoPath) {
        const command = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1:nokey=1 ${videoPath}`;
        const data = execSync(command).toString().split('\n').filter(Boolean)
        return {
            width: parseInt(data[0], 10),
            height: parseInt(data[1], 10),
        }
    }

}

app.post('/upload', upload.single('file'), function (req, res) {
    const uniqueId = uuid4();
    const videoPath = req.file.path;
    const resolution_data = VideoHandler.getVideoResolution(videoPath);

    // Define the resolutions we want to generate (based on the video resolution)
    let resolutions = [
        { label: '320p', width: 512, height: 320 },
        { label: '480p', width: 854, height: 480 },
        { label: '720p', width: 1280, height: 720 },
        { label: '1080p', width: 1920, height: 1080 },
    ];

    // Find the highest resolution available in the video
    const highestResolution = resolutions
        .filter(res => resolution_data.width >= res.width && resolution_data.height >= res.height)
        .pop();
    
    // If there's no valid highest resolution, handle the error
    if (!highestResolution) {
        return res.status(400).json({ message: 'Invalid video resolution' });
    };
    
    resolutions = resolutions.filter(res => highestResolution.width >= res.width && highestResolution.height >= res.height);

    // Create directories for each resolution
    const outputPaths = {};
    resolutions.forEach(res => {
        if (resolution_data.width >= res.width && resolution_data.height >= res.height) {
            const outputPath = `./uploads/courses/${uniqueId}/${res.label}`;
            fs.mkdirSync(outputPath, { recursive: true });
            outputPaths[res.label] = outputPath;
        }
    });

    // Build the dynamic ffmpeg command
    let ffmpegCommand = `ffmpeg -i ${videoPath} -filter_complex "[0:v]split=${resolutions.length}[${resolutions.map(res => res.label).join('][')}];`;
    const filterSegments = [];
    const mapSegments = [];

    resolutions.forEach(res => {
        if (resolution_data.width >= res.width && resolution_data.height >= res.height) {
            const scaleLabel = `${res.label}`;
            filterSegments.push(`[${scaleLabel}]scale=${res.width}:${res.height}[v${scaleLabel}]`);
            mapSegments.push(`-map "[v${scaleLabel}]" -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPaths[res.label]}/segment%03d.ts" -start_number 0 ${outputPaths[res.label]}/${res.label}.m3u8`);
        }
    });

    ffmpegCommand += `${filterSegments.join('; ')}" ${mapSegments.join(' ')}`;
    console.log(ffmpegCommand)

    // Execute the ffmpeg command
    exec(ffmpegCommand, (error, stdout, stderr) => {
        if (error) {
            console.log(`exec error: ${error}`);
            return res.status(500).json({ message: 'Error processing video' });
        }
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);

        // Provide the URL for the generated video
        const videoUrls = `http://localhost:8000/uploads/courses/${uniqueId}`;
        res.json({ message: "uploaded", videoUrl: videoUrls });
    });

    // const ffmpegCommand = `ffmpeg -i ${videoPath} \
    // -filter_complex "[0:v]split=3[320p][480p][1080p]; \
    // [320p]scale=512:320[v320p]; \
    // [480p]scale=854:480[v480p]; \
    // [1080p]scale=1920:1080[v1080p]" \
    // -map "[v320p]" -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath1}/segment%03d.ts" -start_number 0 ${outputPath1}/320p.m3u8 \
    // -map "[v480p]" -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath2}/segment%03d.ts" -start_number 0 ${outputPath2}/480p.m3u8 \
    // -map "[v1080p]" -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_segment_filename "${outputPath3}/segment%03d.ts" -start_number 0 ${outputPath3}/1080p.m3u8`;

});

app.listen(8000, () => {
    console.log('app listening on port 8000');
});