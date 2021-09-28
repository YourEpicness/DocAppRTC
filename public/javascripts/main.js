"use strict";

const $self = {
  rtcConfig: null,
  constraints: {
    audio: false,
    video: true,
  },
};

const $peer = {
  connection: new RTCPeerConnection(),
};

requestUserMedia($self.constraints);

async function requestUserMedia(constraints) {
  const video = document.querySelector("#self");
  $self.stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = $self.stream;
}

// Socket Server Events and Callbacks

const sc = io();
sc.on('connect', () => {
	console.log('Connected to socket.io instance');
})