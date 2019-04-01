// The Alchemy Screen-Space Ambient Obscurance Algorithm (HPG 2011)
// https://dl.acm.org/citation.cfm?id=2018323.2018327
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
