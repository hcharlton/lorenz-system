# Lorentz Attractor with GPGPU

This project demonstrates a Lorentz attractor simulation optimized with General-Purpose computing on Graphics Processing Units (GPGPU) techniques using WebGL2's Transform Feedback feature.

## The Original Approach (CPU-based)

The initial version of this simulation performed the physics calculations for each particle on the CPU within a JavaScript `for` loop.

1.  **Data Flow**:
    *   Particle positions were stored in a JavaScript array.
    *   Each frame, the CPU would iterate through every particle, calculate its new position based on the Lorentz attractor equations, and update the array.
    *   This large array of new positions was then uploaded to the GPU.
2.  **GPU's Role**: The GPU was only responsible for rendering the particles at the positions it received from the CPU.
3.  **Limitation**: This approach creates a performance bottleneck. The CPU is not designed for massively parallel computations like a particle simulation. As the number of particles increases, the CPU struggles to keep up, leading to a drop in framerate. Furthermore, the constant transfer of data from the CPU to the GPU (uploading the positions array each frame) is an expensive operation.

## The New Approach (GPGPU with Transform Feedback)

The refactored version moves the entire physics simulation to the GPU, which is designed for the kind of parallel processing these calculations require. This is achieved using a WebGL2 feature called **Transform Feedback**.

### What is Transform Feedback?

Transform Feedback allows the output of a vertex shader to be captured and written back to a buffer object on the GPU. This means we can perform calculations on the GPU and store the results there without ever having to send the data back to the CPU.

### How It's Used Here

1.  **Data Stays on the GPU**: Particle positions and velocities are stored in buffer objects that live entirely on the GPU. This eliminates the costly CPU-GPU data transfer each frame.

2.  **Two Shader Programs**:
    *   **Update Program (`update_vertex.glsl`)**: This program performs the physics simulation. Its vertex shader takes the current position and velocity of a particle, applies the Lorentz equations to calculate the new position and velocity, and uses Transform Feedback to write these new values back to another set of GPU buffers.
    *   **Render Program (`vertex.glsl`, `fragment.glsl`)**: This is a standard rendering program. Its vertex shader reads the latest particle positions from the GPU buffer (written by the update program) and draws them to the screen.

3.  **The "Ping-Pong" Technique**:
    We use two sets of buffers for positions and velocities (`A` and `B`). In each frame:
    *   The **Update Program** reads from buffer set `A` and writes the new data into buffer set `B`.
    *   The **Render Program** then reads from buffer set `B` to draw the particles.
    *   In the next frame, we swap the roles: the Update Program reads from `B` and writes to `A`, and the Render Program reads from `A`. This is called "ping-ponging" and ensures we are always reading from one buffer while writing to another.

### Advantages of the GPGPU Approach

*   **Massive Parallelism**: The GPU can calculate the new positions and velocities for thousands or even millions of particles simultaneously, something the CPU cannot do.
*   **Reduced Data Transfer**: By keeping the data on the GPU, we avoid the bottleneck of uploading large arrays from the CPU every frame.
*   **Higher Performance**: The result is a much more efficient simulation that can handle a significantly larger number of particles at a smooth framerate, allowing for a more detailed and visually impressive Lorentz attractor.
