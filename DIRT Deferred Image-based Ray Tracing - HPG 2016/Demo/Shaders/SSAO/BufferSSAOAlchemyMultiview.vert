// Multi-view Ambient Occlusion with Importance Sampling (I3D 2013)
// http://dl.acm.org/citation.cfm?id=2448214
// Authors: K. Vardis, G. Papaioannou, A. Gaitatzes
//
// Implementation of Multi-view VO, based on 
// Volumetric Obscurance by Bradford James Loos (I3D 2010)
// https://dl.acm.org/citation.cfm?id=1730829
// Implementation Authors: K. Vardis, G. Papaioannou

#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;
out vec2 TexCoord;
uniform mat4 uniform_mvp;

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   TexCoord = vec2(texcoord0.x,texcoord0.y);
}
