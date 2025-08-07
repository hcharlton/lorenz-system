const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('WebGL not supported');
}

const sigmaSlider = document.getElementById('sigma');
const rhoSlider = document.getElementById('rho');
const betaSlider = document.getElementById('beta');
const dtSlider = document.getElementById('dt');
const numParticlesSlider = document.getElementById('numParticles');
const particleSizeSlider = document.getElementById('particleSize');
const particleBrightnessSlider = document.getElementById('particleBrightness');
const mouseForceSlider = document.getElementById('mouseForce');
const vortexForceSlider = document.getElementById('vortexForce');
const mouseRadiusSlider = document.getElementById('mouseRadius');
const dampingSlider = document.getElementById('damping');
const copyButton = document.getElementById('copyButton');

let vertexShaderSource, fragmentShaderSource;

Promise.all([
    fetch('vertex.glsl').then(response => response.text()),
    fetch('fragment.glsl').then(response => response.text())
]).then(shaders => {
    vertexShaderSource = shaders[0];
    fragmentShaderSource = shaders[1];
    main();
});

function main() {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = createProgram(gl, vertexShader, fragmentShader);

    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const projectionUniformLocation = gl.getUniformLocation(program, 'u_projection');
    const viewUniformLocation = gl.getUniformLocation(program, 'u_view');
    const particleSizeUniformLocation = gl.getUniformLocation(program, 'u_particleSize');
    const particleBrightnessUniformLocation = gl.getUniformLocation(program, 'u_particleBrightness');
    const mousePositionUniformLocation = gl.getUniformLocation(program, 'u_mouse');

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    let positions, velocities;

    function resetParticles() {
        const numParticles = parseInt(numParticlesSlider.value);
        positions = new Float32Array(numParticles * 3);
        velocities = new Float32Array(numParticles * 3);
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] = Math.random() * 50 - 25;
            positions[i + 1] = Math.random() * 50 - 25;
            positions[i + 2] = Math.random() * 50 - 25;
        }
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    }

    numParticlesSlider.addEventListener('input', resetParticles);
    resetParticles();

    let mouseX = 0;
    let mouseY = 0;

    canvas.addEventListener('mousemove', e => {
        mouseX = e.clientX / canvas.width * 2 - 1;
        mouseY = -(e.clientY / canvas.height) * 2 + 1;
    });

    copyButton.addEventListener('click', () => {
        const config = {
            sigma: parseFloat(sigmaSlider.value),
            rho: parseFloat(rhoSlider.value),
            beta: parseFloat(betaSlider.value),
            dt: parseFloat(dtSlider.value),
            numParticles: parseInt(numParticlesSlider.value),
            particleSize: parseFloat(particleSizeSlider.value),
            particleBrightness: parseFloat(particleBrightnessSlider.value),
            mouseForce: parseFloat(mouseForceSlider.value),
            vortexForce: parseFloat(vortexForceSlider.value),
            mouseRadius: parseFloat(mouseRadiusSlider.value),
            damping: parseFloat(dampingSlider.value)
        };
        navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    });

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    const bounds = 50.0; // Define the bounding box size

    function lorentzAttractor(x, y, z, sigma, rho, beta) {
        const dx = sigma * (y - x);
        const dy = x * (rho - z) - y;
        const dz = x * y - beta * z;
        return { dx, dy, dz };
    }

    function getDerivatives(x, y, z, sigma, rho, beta, mouseX_world, mouseY_world, mouseForce, vortexForce, mouseRadius, bounds) {
        // Lorentz attractor derivatives
        const { dx, dy, dz } = lorentzAttractor(x, y, z, sigma, rho, beta);

        // Mouse interaction velocities
        let mvx = 0;
        let mvy = 0;

        const dist = Math.hypot(x - mouseX_world, y - mouseY_world);

        if (dist < mouseRadius * bounds) {
            const forceMag = mouseForce / (dist + 1.0); // Linear falloff, avoid div by zero
            const vortexMag = vortexForce / (dist + 1.0);

            const angle = Math.atan2(y - mouseY_world, x - mouseX_world);

            // Attractive velocity towards mouse
            const vx_attract = -Math.cos(angle) * forceMag;
            const vy_attract = -Math.sin(angle) * forceMag;

            // Vortex velocity (perpendicular to vector from particle to mouse)
            const vx_vortex = Math.sin(angle) * vortexMag;
            const vy_vortex = -Math.cos(angle) * vortexMag;

            mvx = vx_attract + vx_vortex;
            mvy = vy_attract + vy_vortex;
        }

        return { dx: dx + mvx, dy: dy + mvy, dz: dz };
    }

    function update(time) {
        const dt = parseFloat(dtSlider.value);
        const sigma = parseFloat(sigmaSlider.value);
        const rho = parseFloat(rhoSlider.value);
        const beta = parseFloat(betaSlider.value);
        const particleSize = parseFloat(particleSizeSlider.value);
        const particleBrightness = parseFloat(particleBrightnessSlider.value);
        const mouseForce = parseFloat(mouseForceSlider.value);
        const vortexForce = parseFloat(vortexForceSlider.value);
        const mouseRadius = parseFloat(mouseRadiusSlider.value);
        const damping = parseFloat(dampingSlider.value);

        resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Scale mouse coordinates to world coordinates
        const mouseX_world = mouseX * bounds;
        const mouseY_world = mouseY * bounds;

        for (let i = 0; i < positions.length; i += 3) {
            let x = positions[i];
            let y = positions[i+1];
            let z = positions[i+2];

            // RK4 integration for combined Lorentz and mouse forces
            const k1 = getDerivatives(x, y, z, sigma, rho, beta, mouseX_world, mouseY_world, mouseForce, vortexForce, mouseRadius, bounds);
            const k2 = getDerivatives(x + k1.dx * dt * 0.5, y + k1.dy * dt * 0.5, z + k1.dz * dt * 0.5, sigma, rho, beta, mouseX_world, mouseY_world, mouseForce, vortexForce, mouseRadius, bounds);
            const k3 = getDerivatives(x + k2.dx * dt * 0.5, y + k2.dy * dt * 0.5, z + k2.dz * dt * 0.5, sigma, rho, beta, mouseX_world, mouseY_world, mouseForce, vortexForce, mouseRadius, bounds);
            const k4 = getDerivatives(x + k3.dx * dt, y + k3.dy * dt, z + k3.dz * dt, sigma, rho, beta, mouseX_world, mouseY_world, mouseForce, vortexForce, mouseRadius, bounds);

            const avgDx = (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx) / 6.0;
            const avgDy = (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy) / 6.0;
            const avgDz = (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz) / 6.0;

            // Update velocities based on the average derivatives (which now include mouse effects)
            velocities[i] = avgDx;
            velocities[i+1] = avgDy;
            velocities[i+2] = avgDz;

            // Apply damping to velocities
            velocities[i] *= damping;
            velocities[i+1] *= damping;
            velocities[i+2] *= damping;

            // Update positions using the damped velocities
            positions[i] += velocities[i] * dt;
            positions[i+1] += velocities[i+1] * dt;
            positions[i+2] += velocities[i+2] * dt;

            // Bounding box collision detection and response
            // Bounding box collision detection and response
            // If a particle goes out of bounds, reset it near the origin
            if (Math.abs(positions[i]) > bounds ||
                Math.abs(positions[i+1]) > bounds ||
                Math.abs(positions[i+2]) > bounds) {
                console.log('Particle out of bounds, resetting!');
                positions[i] = Math.random() * 40 - 20; // Reset to a wider range
                positions[i+1] = Math.random() * 40 - 20;
                positions[i+2] = Math.random() * 40;
                velocities[i] = 0;
                velocities[i+1] = 0;
                velocities[i+2] = 0;
            }
        }

        gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

        const fieldOfView = 45 * Math.PI / 180;
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -50]);

        gl.uniformMatrix4fv(projectionUniformLocation, false, projectionMatrix);
        gl.uniformMatrix4fv(viewUniformLocation, false, viewMatrix);
        gl.uniform1f(particleSizeUniformLocation, particleSize);
        gl.uniform1f(particleBrightnessUniformLocation, particleBrightness);
        gl.uniform2f(mousePositionUniformLocation, mouseX, mouseY);

        gl.drawArrays(gl.POINTS, 0, positions.length / 3);

        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        return shader;
    }
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return program;
    }
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

function resizeCanvasToDisplaySize(canvas) {
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width  !== displayWidth || canvas.height !== displayHeight) {
        canvas.width  = displayWidth;
        canvas.height = displayHeight;
        return true;
    }

    return false;
}