// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the vertex implementation for the secondary bounce stage

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;
out vec2 vTexCoord;
uniform mat4 uniform_mvp;

flat out int vInstance;

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   vTexCoord = vec2(texcoord0.x,texcoord0.y);
   vInstance = gl_InstanceID;
}
