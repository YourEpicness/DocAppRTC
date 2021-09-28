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
const namespace =window.location.hash.substr(1);

const sc = io(`/${namespace}`, {autoConnect: false});
const button = document.querySelector('#call-button');
const sc = io({autoConnect: false});
button.addEventListener('click', () => {
	sc.open();
})

sc.on('connect', () => {
	console.log('Connected to socket.io instance');
})

sc.on('connected peer', () => {
	console.log('Heard a peer connect!');
})