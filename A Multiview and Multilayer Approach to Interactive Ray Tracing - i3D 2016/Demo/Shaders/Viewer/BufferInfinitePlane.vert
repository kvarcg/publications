//----------------------------------------------------//
//                                                    //
// This is a free rendering engine. The library and   //
// the source code are free. If you use this code as  //
// is or any part of it in any kind of project or     //
// product, please acknowledge the source and its	  //
// author.											  //
//                                                    //
// For manuals, help and instructions, please visit:  //
// http://graphics.cs.aueb.gr/graphics/               //
//                                                    //
//----------------------------------------------------//
#version 330 core
layout(location = 0) in vec3 position;
layout(location = 1) in vec2 texcoord0;

uniform mat4 uniform_mvp;
out vec2 texcoord;
out vec3 pwcs;

void main(void)
{
   gl_Position = uniform_mvp * vec4(position.xyz,1);
   texcoord.xy = texcoord0;
   pwcs = position.xyz;
}
