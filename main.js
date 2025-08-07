const canvas = document.getElementById('glcanvas');
// Use webgl2
const gl = canvas.getContext('webgl2');

if (!gl) {
    alert('WebGL 2 not supported');
}

const sigmaSlider = document.getElementById('sigma');
const rhoSlider = document.getElementById('rho');
const betaSlider = document.getElementById('beta');
const dtSlider = document.getElementById('dt');
const numParticlesSlider = document.getElementById('numParticles');
const particleSizeSlider = document.getElementById('particleSize');
const particleBrightnessSlider = document.getElementById('particleBrightness');
const mouseForceSlider = document.getElementById('mouseForce');
const mouseRadiusSlider = document.getElementById('mouseRadius');
const dampingSlider = document.getElementById('damping');
const copyButton = document.getElementById('copyButton');

let vertexShaderSource, fragmentShaderSource, updateVertexShaderSource, updateFragmentShaderSource;

Promise.all([
    fetch('vertex.glsl').then(response => response.text()),
    fetch('fragment.glsl').then(response => response.text()),
    fetch('update_vertex.glsl').then(response => response.text()),
    fetch('update_fragment.glsl').then(response => response.text())
]).then(shaders => {
    vertexShaderSource = shaders[0];
    fragmentShaderSource = shaders[1];
    updateVertexShaderSource = shaders[2];
    updateFragmentShaderSource = shaders[3];
    main();
});

function main() {
    // Create programs
    const renderProgram = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    const updateProgram = createProgram(
        gl,
        updateVertexShaderSource,
        updateFragmentShaderSource,
        ['v_position', 'v_velocity']
    );

    // Get locations of attributes and uniforms
    const renderLocations = {
        position: gl.getAttribLocation(renderProgram, 'a_position'),
        projection: gl.getUniformLocation(renderProgram, 'u_projection'),
        view: gl.getUniformLocation(renderProgram, 'u_view'),
        particleSize: gl.getUniformLocation(renderProgram, 'u_particleSize'),
        particleBrightness: gl.getUniformLocation(renderProgram, 'u_particleBrightness'),
    };

    const updateLocations = {
        position: gl.getAttribLocation(updateProgram, 'a_position'),
        velocity: gl.getAttribLocation(updateProgram, 'a_velocity'),
        sigma: gl.getUniformLocation(updateProgram, 'u_sigma'),
        rho: gl.getUniformLocation(updateProgram, 'u_rho'),
        beta: gl.getUniformLocation(updateProgram, 'u_beta'),
        dt: gl.getUniformLocation(updateProgram, 'u_dt'),
        mouse: gl.getUniformLocation(updateProgram, 'u_mouse'),
        mouseForce: gl.getUniformLocation(updateProgram, 'u_mouseForce'),
        mouseRadius: gl.getUniformLocation(updateProgram, 'u_mouseRadius'),
        damping: gl.getUniformLocation(updateProgram, 'u_damping'),
    };

    // --- State variables
    let current;
    let next;
    let numParticles;
    let mouseX = 0;
    let mouseY = 0;

    // --- VAO and Buffer setup
    function createVAOAndBuffers(gl, initialData) {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        // --- Position Buffer ---
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, initialData.positions, gl.DYNAMIC_DRAW);
        // Configure attribute for location 0 (used by both programs)
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        // --- Velocity Buffer ---
        const velocityBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, velocityBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, initialData.velocities, gl.DYNAMIC_DRAW);
        // Configure attribute for location 1 (used by update program)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return {
            vao: vao,
            buffers: {
                position: positionBuffer,
                velocity: velocityBuffer,
            }
        };
    }

    function createInitialData(count) {
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 25 + 25;
            // Give each particle a small random initial velocity
            velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.5;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        }
        return { positions, velocities };
    }

    function resetParticles() {
        numParticles = parseInt(numParticlesSlider.value);
        const initialData = createInitialData(numParticles);

        // Clean up old WebGL objects if they exist
        if (current) {
            gl.deleteBuffer(current.buffers.position);
            gl.deleteBuffer(current.buffers.velocity);
            gl.deleteVertexArray(current.vao);
        }
        if (next) {
            gl.deleteBuffer(next.buffers.position);
            gl.deleteBuffer(next.buffers.velocity);
            gl.deleteVertexArray(next.vao);
        }

        // Create new VAOs and buffers for ping-ponging
        current = createVAOAndBuffers(gl, initialData);
        next = createVAOAndBuffers(gl, initialData);
    }

    resetParticles(); // Initial setup
    numParticlesSlider.addEventListener('input', resetParticles);

    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / canvas.width * 2 - 1;
        mouseY = (e.clientY - rect.top) / canvas.height * -2 + 1;
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
            mouseRadius: parseFloat(mouseRadiusSlider.value),
            damping: parseFloat(dampingSlider.value),
        };
        navigator.clipboard.writeText(JSON.stringify(config, null, 2));
        alert('Configuration copied to clipboard!');
    });

    const transformFeedback = gl.createTransformFeedback();

    function update(time) {
        resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // 1. UPDATE PARTICLE STATE
        gl.useProgram(updateProgram);
        
        // Bind the VAO that contains the current state's buffers and attribute pointers.
        gl.bindVertexArray(current.vao);

        // Set uniforms for the update shader
        gl.uniform1f(updateLocations.sigma, parseFloat(sigmaSlider.value));
        gl.uniform1f(updateLocations.rho, parseFloat(rhoSlider.value));
        gl.uniform1f(updateLocations.beta, parseFloat(betaSlider.value));
        gl.uniform1f(updateLocations.dt, parseFloat(dtSlider.value));
        gl.uniform2f(updateLocations.mouse, mouseX, mouseY);
        gl.uniform1f(updateLocations.mouseForce, parseFloat(mouseForceSlider.value));
        gl.uniform1f(updateLocations.mouseRadius, parseFloat(mouseRadiusSlider.value));
        gl.uniform1f(updateLocations.damping, parseFloat(dampingSlider.value));

        // We don't want to render anything during the update step.
        gl.enable(gl.RASTERIZER_DISCARD);

        // Set up transform feedback to write to the 'next' buffers
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, next.buffers.position);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, next.buffers.velocity);

        // Perform the simulation by drawing points. The vertex shader will run for each point.
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, numParticles);
        gl.endTransformFeedback();

        // Clean up transform feedback state
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        
        // Re-enable rasterization for the render step
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindVertexArray(null);


        // 2. RENDER PARTICLES
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(renderProgram);
        
        // Bind the VAO that contains the newly updated state
        gl.bindVertexArray(next.vao);

        // Set uniforms for the render shader
        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, 45 * Math.PI / 180, gl.canvas.clientWidth / gl.canvas.clientHeight, 0.1, 200.0);
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, [0, 0, 100], [0, 0, 0], [0, 1, 0]);

        gl.uniformMatrix4fv(renderLocations.projection, false, projectionMatrix);
        gl.uniformMatrix4fv(renderLocations.view, false, viewMatrix);
        gl.uniform1f(renderLocations.particleSize, parseFloat(particleSizeSlider.value));
        gl.uniform1f(renderLocations.particleBrightness, parseFloat(particleBrightnessSlider.value));

        // Draw the particles
        gl.drawArrays(gl.POINTS, 0, numParticles);
        gl.bindVertexArray(null);


        // 3. SWAP BUFFERS
        // The 'next' state becomes the 'current' state for the next frame.
        let temp = current;
        current = next;
        next = temp;

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

function createProgram(gl, vertexShaderSource, fragmentShaderSource, transformFeedbackVaryings) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    if (transformFeedbackVaryings) {
        gl.transformFeedbackVaryings(
            program,
            transformFeedbackVaryings,
            gl.SEPARATE_ATTRIBS
        );
    }

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