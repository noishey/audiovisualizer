import * as THREE from 'three';
import {GUI} from 'dat.gui';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass';

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
//renderer.setClearColor(0x222222);

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
    threshold: 0.5,
    strength: 0.5,
    radius: 0.8,
    // Media controls defaults
    bgImageUrl: '',
    audioUrl: 'https://samplelib.com/lib/preview/mp3/sample-12s.mp3',
    foreground: true,
    foregroundOpacity: 1.0
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

const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);

const audioLoader = new THREE.AudioLoader();
function handleAudioBuffer(buffer) {
  sound.setBuffer(buffer);
  window.addEventListener('click', function() {
    sound.play();
  });
}
// Try local file first; fallback to default sample
audioLoader.load('/Beats.mp3', handleAudioBuffer, undefined, function() {
  audioLoader.load(params.audioUrl, handleAudioBuffer);
});

function loadAudio(url) {
  try {
    if (sound.isPlaying) sound.stop();
  } catch (e) {}
  audioLoader.load(url, handleAudioBuffer);
}

const analyser = new THREE.AudioAnalyser(sound, 32);

const gui = new GUI();

const colorsFolder = gui.addFolder('Colors');
colorsFolder.add(params, 'red', 0, 255).step(1).onChange(function(value) {
    uniforms.u_red.value = Number(value) / 255;
});
colorsFolder.add(params, 'green', 0, 255).step(1).onChange(function(value) {
    uniforms.u_green.value = Number(value) / 255;
});
colorsFolder.add(params, 'blue', 0, 255).step(1).onChange(function(value) {
    uniforms.u_blue.value = Number(value) / 255;
});

const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(params, 'threshold', 0, 1).onChange(function(value) {
    bloomPass.threshold = Number(value);
});
bloomFolder.add(params, 'strength', 0, 3).onChange(function(value) {
    bloomPass.strength = Number(value);
});
bloomFolder.add(params, 'radius', 0, 1).onChange(function(value) {
    bloomPass.radius = Number(value);
});

// Media controls: background image and audio
const mediaFolder = gui.addFolder('Media');
// Hidden file inputs for local selection
const bgFileInput = document.createElement('input');
bgFileInput.type = 'file';
bgFileInput.accept = 'image/*';
bgFileInput.style.display = 'none';
document.body.appendChild(bgFileInput);

const audioFileInput = document.createElement('input');
audioFileInput.type = 'file';
audioFileInput.accept = 'audio/*';
audioFileInput.style.display = 'none';
document.body.appendChild(audioFileInput);

// Track current object URLs to revoke when replaced
let currentBgObjectUrl = null;
let currentAudioObjectUrl = null;

// Foreground overlay image element
const overlayImg = document.createElement('img');
overlayImg.style.position = 'fixed';
overlayImg.style.left = '0';
overlayImg.style.top = '0';
overlayImg.style.width = '100%';
overlayImg.style.height = '100%';
overlayImg.style.objectFit = 'cover';
overlayImg.style.zIndex = '10';
overlayImg.style.pointerEvents = 'none';
overlayImg.style.display = params.foreground ? 'block' : 'none';
overlayImg.style.opacity = String(params.foregroundOpacity);
document.body.appendChild(overlayImg);

function setForegroundImage(url) {
    if (!url) {
        overlayImg.style.display = 'none';
        overlayImg.src = '';
        return;
    }
    overlayImg.src = url;
    overlayImg.style.display = params.foreground ? 'block' : 'none';
    overlayImg.style.opacity = String(params.foregroundOpacity);
}

mediaFolder.add(params, 'bgImageUrl').name('Background URL');
mediaFolder.add({
    loadBackground: function() {
        if (!params.bgImageUrl) {
            // Clear background if empty
            scene.background = null;
            document.body.style.backgroundImage = '';
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            setForegroundImage('');
            return;
        }
        const loader = new THREE.TextureLoader();
        loader.load(
            params.bgImageUrl,
            function(texture) {
                // Prefer scene background texture
                scene.background = texture;
                // Also set body background as fallback visual
                document.body.style.backgroundImage = `url(${params.bgImageUrl})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                // Bring image to foreground overlay
                setForegroundImage(params.bgImageUrl);
            },
            undefined,
            function() {
                // On error, fallback to CSS background image
                document.body.style.backgroundImage = `url(${params.bgImageUrl})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                setForegroundImage(params.bgImageUrl);
            }
        );
    }
}, 'loadBackground').name('Load Background');

mediaFolder.add({
    selectBackground: function() {
        bgFileInput.click();
    }
}, 'selectBackground').name('Select Background');

bgFileInput.addEventListener('change', function() {
    const file = bgFileInput.files && bgFileInput.files[0];
    if (!file) return;
    if (currentBgObjectUrl) {
        try { URL.revokeObjectURL(currentBgObjectUrl); } catch (e) {}
    }
    const objectUrl = URL.createObjectURL(file);
    currentBgObjectUrl = objectUrl;
    const loader = new THREE.TextureLoader();
    loader.load(
        objectUrl,
        function(texture) {
            scene.background = texture;
            document.body.style.backgroundImage = `url(${objectUrl})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            setForegroundImage(objectUrl);
        },
        undefined,
        function() {
            document.body.style.backgroundImage = `url(${objectUrl})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            setForegroundImage(objectUrl);
        }
    );
});

mediaFolder.add(params, 'audioUrl').name('Audio URL');
mediaFolder.add({
    loadAudio: function() {
        loadAudio(params.audioUrl);
    }
}, 'loadAudio').name('Load Audio');

mediaFolder.add({
    selectAudio: function() {
        audioFileInput.click();
    }
}, 'selectAudio').name('Select Audio');

audioFileInput.addEventListener('change', function() {
    const file = audioFileInput.files && audioFileInput.files[0];
    if (!file) return;
    if (currentAudioObjectUrl) {
        try { URL.revokeObjectURL(currentAudioObjectUrl); } catch (e) {}
    }
    const objectUrl = URL.createObjectURL(file);
    currentAudioObjectUrl = objectUrl;
    loadAudio(objectUrl);
});
mediaFolder.add({
    play: function() {
        try { sound.play(); } catch (e) {}
    }
}, 'play').name('Play');
mediaFolder.add({
    stop: function() {
        try { sound.stop(); } catch (e) {}
    }
}, 'stop').name('Stop');

// Foreground controls
mediaFolder.add(params, 'foreground').name('Foreground Image').onChange(function(value) {
    overlayImg.style.display = value ? 'block' : 'none';
});
mediaFolder.add(params, 'foregroundOpacity', 0, 1).step(0.01).name('Foreground Opacity').onChange(function(value) {
    overlayImg.style.opacity = String(value);
});
mediaFolder.add({
    clearForeground: function() {
        overlayImg.src = '';
        overlayImg.style.display = 'none';
    }
}, 'clearForeground').name('Clear Foreground');

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