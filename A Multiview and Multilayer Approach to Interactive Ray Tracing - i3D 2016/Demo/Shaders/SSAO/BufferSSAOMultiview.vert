// Multi-view Ambient Occlusion with Importance Sampling (I3D 2013)
// http://dl.acm.org/citation.cfm?id=2448214
// Authors: K. Vardis, G. Papaioannou, A. Gaitatzes
//
// Implementation of Multi-view SSAO, based on 
// Screen-Space Ambient Occlusion (ACM SIGGRAPH 2007 courses)
// https://dl.acm.org/citation.cfm?doid=1281500.1281671
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
