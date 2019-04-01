// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the vertex implementation for the creation stage of the geometry volume

#version 330 core
#extension GL_EXT_gpu_shader4 : enable

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;
layout(location = 4) in vec2 texcoord1;
layout(location = 5) in vec3 tangent;

uniform mat4 uniform_model;

void main(void)
{
	gl_Position = uniform_model * vec4(position,1);
}
