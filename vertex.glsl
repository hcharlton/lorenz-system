#version 300 es
layout(location = 0) in vec3 a_position;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_particleSize;

void main() {
    vec4 viewPos = u_view * vec4(a_position, 1.0);
    gl_Position = u_projection * viewPos;
    // Perspective-correct point size: scale by distance from camera
    float dist = abs(viewPos.z);
    gl_PointSize = u_particleSize * (100.0 / dist);
}