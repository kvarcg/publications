// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the vertex implementation for the generation of the occupancy volume stage via downsampling

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;

out vec2 TexCoord;

void main(void)
{   
   gl_Position = vec4(position,1);
   TexCoord = texcoord0;
}
