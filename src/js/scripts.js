import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
const pillFrame = document.getElementById("pillFrame");

// Set renderer to pillFrame size
renderer.setSize(pillFrame.clientWidth, pillFrame.clientHeight);
pillFrame.appendChild(renderer.domElement);

// Make renderer transparent (so background image shows through)
renderer.setClearColor(0x000000, 0); // alpha = 0

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

const params = {
    red: 255,
    green: 255,
    blue: 255,
    threshold: 0.0,
    strength: 0.27,
    radius: 0.0,
};

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
camera.aspect = pillFrame.clientWidth / pillFrame.clientHeight;
camera.updateProjectionMatrix();
camera.lookAt(0, 0, 0);

const uniforms = {
    u_time: { type: "f", value: 0.0 },
    u_frequency: { type: "f", value: 0.0 },
    u_red: { type: "f", value: 1.0 },
    u_green: { type: "f", value: 1.0 },
    u_blue: { type: "f", value: 1.0 },
};

// Initialize color uniforms from 0–255 params to normalized 0–1
uniforms.u_red.value = params.red / 255;
uniforms.u_green.value = params.green / 255;
uniforms.u_blue.value = params.blue / 255;

const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: document.getElementById("vertexshader").textContent,
    fragmentShader: document.getElementById("fragmentshader").textContent,
});

const geo = new THREE.IcosahedronGeometry(2.4, 30);
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);
mesh.position.y = 1.0;
mesh.material.wireframe = true;
// Make mesh visible since strength is now fixed at 0.27 (> 0)
mesh.visible = true;

// External RMS variable to receive values from JUCE webapp
let externalRMS = 0.0;

// Global function to update RMS from external source (JUCE webapp)
window.updateRMS = function (rmsValue) {
    externalRMS = parseFloat(rmsValue) || 0.0;
    console.log("RMS updated from external source:", externalRMS);
};

// Dynamically set background and foreground from JUCE
window.setBackgroundImage = function (url) {
    console.log("Background image received from JUCE:", url);

    // Update background via CSS
    document.getElementById("pillFrame").style.backgroundImage = `url("${url}")`;

    // Extract colors from background for shader
    // Extract bright colors from background for shader
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const pixelCount = 1000; // number of random samples
        const brightPixels = [];

        // Collect multiple bright pixels
        for (let i = 0; i < pixelCount; i++) {
            const x = Math.floor(Math.random() * img.width);
            const y = Math.floor(Math.random() * img.height);
            const data = ctx.getImageData(x, y, 1, 1).data;

            // Calculate brightness (luminance)
            const brightness = 0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2];

            // Keep only bright pixels (threshold ~180/255)
            if (brightness > 180) {
                brightPixels.push(data);
            }
        }

        let pixelData;
        if (brightPixels.length > 0) {
            // Choose a random bright pixel
            pixelData = brightPixels[Math.floor(Math.random() * brightPixels.length)];
        } else {
            // Fallback: if no bright pixel found, use the last random one
            const randomX = Math.floor(Math.random() * img.width);
            const randomY = Math.floor(Math.random() * img.height);
            pixelData = ctx.getImageData(randomX, randomY, 1, 1).data;
        }

        // Apply to shader
        params.red = pixelData[0];
        params.green = pixelData[1];
        params.blue = pixelData[2];

        uniforms.u_red.value = params.red / 255;
        uniforms.u_green.value = params.green / 255;
        uniforms.u_blue.value = params.blue / 255;

        console.log(`Visualizer colors (bright) updated from JUCE background: R:${params.red}, G:${params.green}, B:${params.blue}`);
    };
    img.src = url;
};

window.setForegroundImage = function (url) {
    console.log("Foreground image received from JUCE:", url);

    // Otherwise create it
    const overlayImg = document.getElementById("foregroundImg");
    overlayImg.src = url;
};

let mouseX = 0;
let mouseY = 0;
document.addEventListener("mousemove", function (e) {
    let windowHalfX = document.body.clientWidth / 2;
    let windowHalfY = document.body.clientHeight / 2;
    mouseX = (e.clientX - windowHalfX) / 100;
    mouseY = (e.clientY - windowHalfY) / 100;
});

// This function is callable from JUCE
window.fromJUCE = function (msg) {
    console.log("Received message from JUCE:", msg);

    // Example: focus or highlight a continent
    if (msg.type === "rmsChange" && msg.value) {
        externalRMS = parseFloat(msg.value) || 0.0;
        console.log("RMS updated from external source:", externalRMS);
    } else if (msg.type === "foregroundImg" && msg.path) {
        setForegroundImage(msg.path);
    } else if (msg.type === "backgroundImg" && msg.path) {
        setBackgroundImage(msg.path);
    }
};

const clock = new THREE.Clock();
function animate() {
    camera.position.x += (mouseX - camera.position.x) * 0.05;
    camera.position.y += (-mouseY - camera.position.y) * 0.5;
    camera.lookAt(scene.position);
    uniforms.u_time.value = clock.getElapsedTime();

    // Use external RMS value from JUCE app
    // The externalRMS value should be in a normalized range (0.0 to 1.0)
    // Scale it for better visual effect
    uniforms.u_frequency.value = externalRMS * 100; // Scale up for dramatic effect

    bloomComposer.render();
    requestAnimationFrame(animate);
}
animate();

window.addEventListener("resize", function () {
    renderer.setSize(pillFrame.clientWidth, pillFrame.clientHeight);
    camera.aspect = pillFrame.clientWidth / pillFrame.clientHeight;
    camera.updateProjectionMatrix();
    bloomComposer.setSize(pillFrame.clientWidth, pillFrame.clientHeight);
});
