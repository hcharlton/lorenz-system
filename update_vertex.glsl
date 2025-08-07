#version 300 es
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_velocity;

uniform float u_sigma;
uniform float u_rho;
uniform float u_beta;
uniform float u_dt;
uniform vec2 u_mouse;
uniform float u_mouseForce;
uniform float u_mouseRadius;
uniform float u_damping;

out vec3 v_position;
out vec3 v_velocity;

void main() {
    vec3 pos = a_position;
    vec3 vel = a_velocity;

    // Lorentz attractor equations
    float dx = u_sigma * (pos.y - pos.x);
    float dy = pos.x * (u_rho - pos.z) - pos.y;
    float dz = pos.x * pos.y - u_beta * pos.z;

    vec3 force = vec3(dx, dy, dz);
    vel += force * u_dt;

    // Mouse interaction
    vec2 mouse_pos_ndc = u_mouse;
    vec3 mouse_world = vec3(mouse_pos_ndc.x * 100.0, mouse_pos_ndc.y * 100.0, 50.0);
    float dist = distance(pos, mouse_world);
    if (dist < u_mouseRadius * 200.0) {
        vec3 dir = normalize(pos - mouse_world);
        vel += dir * u_mouseForce * 0.1 * (1.0 - dist / (u_mouseRadius * 200.0));
    }

    // Damping
    vel *= u_damping;

    // Update position
    pos += vel * u_dt;

    // Bouncing off wider walls
    if (abs(pos.x) > 100.0) { vel.x *= -1.0; }
    if (abs(pos.y) > 100.0) { vel.y *= -1.0; }
    if (pos.z < 0.0 || pos.z > 100.0) { vel.z *= -1.0; }


    v_position = pos;
    v_velocity = vel;
}
