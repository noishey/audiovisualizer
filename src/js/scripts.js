import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass';
import backgroundImg from '../assets/images/background.png';
import foregroundImg from '../assets/images/foreground.png';
import sampleAudio from '../assets/audio/sample.mp3';

const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, -1); // Transparent clear color
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	45,
	window.innerWidth / window.innerHeight,
	0.1,
	1000
);

const params = {
    red: 255,
    green: 255,
    blue: 255,
    threshold: 0.0,
    strength: 0.27,
    radius: 0.0
}

renderer.outputColorSpace = THREE.SRGBColorSpace;

const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight));
bloomPass.threshold = params.threshold;
bloomPass.strength = params.strength;
bloomPass.radius = params.radius;

const bloomComposer = new EffectComposer(renderer);
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

const outputPass = new OutputPass();
bloomComposer.addPass(outputPass);

camera.position.set(0, -2, 14);
camera.lookAt(0, 0, 0);

const uniforms = {
    u_time: {type: 'f', value: 0.0},
    u_frequency: {type: 'f', value: 0.0},
    u_red: {type: 'f', value: 1.0},
    u_green: {type: 'f', value: 1.0},
    u_blue: {type: 'f', value: 1.0}
}

// Initialize color uniforms from 0–255 params to normalized 0–1
uniforms.u_red.value = params.red / 255;
uniforms.u_green.value = params.green / 255;
uniforms.u_blue.value = params.blue / 255;

const mat = new THREE.ShaderMaterial({
	uniforms,
	vertexShader: document.getElementById('vertexshader').textContent,
	fragmentShader: document.getElementById('fragmentshader').textContent
});

const geo = new THREE.IcosahedronGeometry(2.4, 30 );
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);
mesh.position.y = 1.0;
mesh.material.wireframe = true;
// Make mesh visible since strength is now fixed at 0.27 (> 0)
mesh.visible = true;

const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);

const audioLoader = new THREE.AudioLoader();

function handleAudioBuffer(buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.5);
    sound.play();
    console.log('Audio loaded and playing');
}

function loadAudio(url) {
  try {
    if (sound.isPlaying) sound.stop();
  } catch (e) {}
  audioLoader.load(url, handleAudioBuffer);
}

const analyser = new THREE.AudioAnalyser(sound, 32);

// Auto-load background and foreground images
// Load background image using CSS DOM loading (original image as uploaded)
document.body.style.backgroundImage = `url("${backgroundImg}")`;
document.body.style.backgroundSize = 'cover';
document.body.style.backgroundPosition = 'center';
document.body.style.backgroundRepeat = 'no-repeat';
document.body.style.backgroundAttachment = 'fixed';
console.log('Background CSS applied:', document.body.style.backgroundImage);

// Extract random RGB values from background image for visualizer
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const img = new Image();
img.crossOrigin = 'anonymous';
img.onload = function() {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    
    // Get random pixel from the image
    const randomX = Math.floor(Math.random() * img.width);
    const randomY = Math.floor(Math.random() * img.height);
    const pixelData = ctx.getImageData(randomX, randomY, 1, 1).data;
    
    // Extract RGB values
    const extractedRed = pixelData[0];
    const extractedGreen = pixelData[1];
    const extractedBlue = pixelData[2];
    
    console.log(`Extracted RGB from background: R:${extractedRed}, G:${extractedGreen}, B:${extractedBlue}`);
    
    // Update visualizer parameters with extracted colors
    params.red = extractedRed;
    params.green = extractedGreen;
    params.blue = extractedBlue;
    
    // Update shader uniforms
    uniforms.u_red.value = params.red / 255;
    uniforms.u_green.value = params.green / 255;
    uniforms.u_blue.value = params.blue / 255;
    
    console.log(`Visualizer colors updated: R:${params.red}, G:${params.green}, B:${params.blue}`);
};
img.src = backgroundImg;

// Auto-load sample audio
console.log('Loading sample audio:', sampleAudio);
loadAudio(sampleAudio);

// Create and auto-load foreground overlay
const overlayImg = document.createElement('img');
overlayImg.src = foregroundImg;
overlayImg.style.position = 'fixed';
overlayImg.style.left = '0';
overlayImg.style.top = '0';
overlayImg.style.width = '100%';
overlayImg.style.height = '100%';
overlayImg.style.objectFit = 'cover';
overlayImg.style.zIndex = '5';
overlayImg.style.pointerEvents = 'none';
overlayImg.style.opacity = '0.85';
overlayImg.style.display = 'block';
document.body.appendChild(overlayImg);


let mouseX = 0;
let mouseY = 0;
document.addEventListener('mousemove', function(e) {
	let windowHalfX = window.innerWidth / 2;
	let windowHalfY = window.innerHeight / 2;
	mouseX = (e.clientX - windowHalfX) / 100;
	mouseY = (e.clientY - windowHalfY) / 100;
});

const clock = new THREE.Clock();
function animate() {
	camera.position.x += (mouseX - camera.position.x) * .05;
	camera.position.y += (-mouseY - camera.position.y) * 0.5;
	camera.lookAt(scene.position);
	uniforms.u_time.value = clock.getElapsedTime();
	uniforms.u_frequency.value = analyser.getAverageFrequency();
    bloomComposer.render();
	requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
	bloomComposer.setSize(window.innerWidth, window.innerHeight);
});