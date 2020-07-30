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
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;
layout(location = 4) in vec2 texcoord1;
layout(location = 5) in vec3 tangent;

uniform mat4 uniform_mvp;
uniform uint uniform_itemID;

out vec4 vertex_color;
out vec4[2] TexCoord;
flat out uint itemID;

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   vertex_color = color;
   itemID = uniform_itemID;
   TexCoord[0] = vec4(texcoord0.xy,0,1);
   TexCoord[1] = vec4(texcoord1.xy,0,1);
}
