"use strict";

const $self = {
  rtcConfig: null,
  constraints: {
    audio: false,
    video: true,
  },
  isHost: false,
  isMakingOffer: false,
  isIgnoringOffer: false,
  isSettingRemoteAnswerPending: false
};

const $peer = {
  connection: new RTCPeerConnection($self.rtcConfig),
};

requestUserMedia($self.constraints);

async function requestUserMedia(constraints) {
  $self.stream = await navigator.mediaDevices.getUserMedia(constraints);
  displayStream('#self', $self.stream);
}

// User-Media/DOM
function displayStream(selector, stream) {
	const video = document.querySelector(selector);
	video.srcObject = stream;
}

// DOM Events

function handleButton(e) {
	const button = e.target;
	if (button.className === 'join') {
		// button.className = 'leave';
		// button.innerText = 'Leave Call';
		joinCall();
	} else {
		// button.className = 'join';
		// button.innerText = 'Join Call';
		// leaveCall();
	}
}

function handleChatForm(e) {
	e.preventDefault();
	const form = e.target;
	const input = form.querySelector('.chat-field');
	const message = input.value;

	appendMessage('self', message);
	
	$peer.chatChannel.send(message);

	// Reset chat form when submit
	input.value = '';
}

function appendMessage(sender, message) {
	const log = document.querySelector('#chat-log');

	const li = document.createElement('li');
	li.innerText = message;
	li.className = 'self';

	log.appendChild(li);
}

// Socket Server Events and Callbacks
const namespace = prepareNamespace(window.location.hash, true);

const sc = io(`/${namespace}`, {autoConnect: false});

registerScEvents();

// DOM Elements

const button = document.querySelector('#call-button');
const leave_button = document.querySelector("#leave");
const chat_form = document.querySelector('.message');
const wait_room = document.querySelector('#header');
const call_window = document.querySelector('.container');
const wait_video = document.querySelector('.waitroom__video');

button.addEventListener('click', handleButton);
leave_button.addEventListener('click', leaveCall);
chat_form.addEventListener('submit', handleChatForm);

document.querySelector('#header h1').innerText = `Welcome to Room #${namespace}`

function joinCall() {
	sc.open();
	registerRtcEvents($peer);
	establishCallFeatures($peer);
	wait_room.classList.add('hide');
	call_window.classList.remove('hide');
}

function leaveCall() {
	$peer.connection.close();
	$peer.connection = new RTCPeerConnection($self.rtcConfig);
	displayStream('#peer', null)
	wait_room.classList.remove('hide');
	call_window.classList.add('hide');
	sc.close();
}

// WebRTC Events
function establishCallFeatures(peer) {
	peer.connection.addTrack($self.stream.getTracks()[0],
	$self.stream);
	peer.chatChannel = peer.connection.createDataChannel('chat', {
		negotiated: true, 
		id: 50
	});
	peer.chatChannel.onmessage = function({ data }) {
		appendMessage('peer', data);
	}
}

function registerRtcEvents(peer) {
	peer.connection.onnegotiationneeded = handleRtcNegotiation;
	peer.connection.onicecandidate = handleIceCandidate;
	peer.connection.ontrack = handleRtcTrack;
	peer.connection.ondatachannel = handleRtcDataChannel;
}

async function handleRtcNegotiation() {
	console.log('RTC negotiation needed...');
	// send SDP description
	$self.isMakingOffer = true;
	try {
		// modern setLocalDescription
		await $peer.connection.setLocalDescription();
	} catch(e) {
		// fallback for old browsers
		const offer = await $peer.connection.createOffer();
		await $peer.connection.setLocalDescription(offer);
	} finally {
		// ^...
		sc.emit('signal', {
			description: $peer.connection.localDescription
		});
	}
	$self.isMakingOffer = false;
}

function handleRtcDataChannel({ channel }) {
	console.log('Heard channel', channel.label, 'with ID', channel.id);
	document.querySelector('#peer').className = channel.label;
}

function handleIceCandidate({ candidate }) {
	sc.emit('signal', {
		candidate: candidate
	})
}

function handleRtcTrack({ track, streams: [stream]}) {
	// attach our track to the DOM
	displayStream('#peer', stream);
}

// Signaling Channel Events

function registerScEvents() {
	sc.on('connect', handleScConnect);
	sc.on('connected peer', handleScConnectedPeer);
	sc.on('signal', handleScSignal);
	sc.on('disconnected peer', handleScDisconnectedPeer);
}

function handleScConnect() {
	console.log('Connected to signaling channel!');
}

function handleScConnectedPeer() {
	console.log('Heard connected peer event!');
	$self.isHost = true;
}

function handleScDisconnectedPeer() {
	console.log('Heard disconnected peer event!');
	displayStream('#peer', null);
	$peer.connection.close();
	$peer.connection = new RTCPeerConnection($self.rtcConfig);
	registerRtcEvents($peer);
	establishCallFeatures($peer);
}

async function handleScSignal({ description, candidate}) {
	console.log('Heard signal event!');
	if(description) {
		console.log('Received SDP Signal:', description);

		const readyForOffer = !$self.isMakingOffer && ($peer.connection.signalingState === 'stable' || $self.isSettingRemoteAnswerPending);
		
		const offerCollision = description.type === 'offer' && !readyForOffer
		
		$self.isIgnoringOffer = !$self.isHost && offerCollision;

		if($self.isIgnoringOffer) return;

		$self.isSettingRemoteAnswerPending = description.type === 'answer';
		await $peer.connection.setRemoteDescription(description);

		if(description.type === 'offer') {
			try {
				// modern setLocalDescription
				await $peer.connection.setLocalDescription();
			} catch(e) {
				// fallback for old browsers
				const answer = await $peer.connection.createAnswer();
				await $peer.connection.setLocalDescription(offer);
			} finally {
				// ^...
				sc.emit('signal', {
					description: $peer.connection.localDescription
				});
			}
		} else if(candidate) {
			console.log('Receieved ICE candidate:', candidate);
		}

	} else if (candidate) {
		console.log('Received ICE candidate:', candidate);

		try {
			await $peer.connection.addIceCandidate(candidate);
		} catch(e) {
			if(!$self.isIgnoringOffer) {
				console.error('Cannot add ICE candidadte for peer', e);
			}
		}
	}
}

// Utility Functions
async function handleFallbackRtc(offerType) {
	try {
		// modern setLocalDescription
		await $peer.connection.setLocalDescription();
	} catch(e) {
		// fallback for old browsers
		const offer = await $peer.connection.offerType;
		await $peer.connection.setLocalDescription(offer);
	} finally {
		// ^...
		sc.emit('signal', {
			description: $peer.connection.localDescription
		});
	}
}

function prepareNamespace(hash, set_location) {
	let ns = hash.replace(/^#/, ''); // remove # from hash
	if(/^[0-9]{6}$/.test(ns)) {
		console.log('Checked existing namespace', ns);
		return ns;
	}
	ns = Math.random().toString().substring(2, 8);
	console.log('Created new namespace', ns);
	if(set_location) window.location.hash = ns;
	return ns;
}