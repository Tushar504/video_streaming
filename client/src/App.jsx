import React from 'react';
import './App.css'
import VideoJS from './VideoJS'

const App = () => {
  const playerRef = React.useRef(null);

  const videoJsOptions = {
    controls: true,
    responsive: true,
    fluid: true,
    sources: [{
      src: 'http://localhost:8000/uploads/courses/ae20e942-1b8c-480f-81a9-e6334cddd56a/720p/720p.m3u8',
      type: 'video/x-mpegURL'
    }]
  };

  const handlePlayerReady = (player) => {
    playerRef.current = player;

    // You can handle player events here, for example:
    player.on('waiting', () => {
      videojs.log('player is waiting');
    });

    player.on('dispose', () => {
      videojs.log('player will dispose');
    });
  };

  return (
    <>
      <div>Rest of app here</div>
      <VideoJS options={videoJsOptions} onReady={handlePlayerReady} />
      <div>Rest of app here</div>
    </>
  );
}

export default App;