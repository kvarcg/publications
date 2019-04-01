//----------------------------------------------------//
//													  // 
// Copyright: Athens University of Economics and	  //
// Business											  //
// Authors: Kostas Vardis, Georgios Papaioannou   	  //
// 													  //
// If you use this code as is or any part of it in    //
// any kind of project or product, please acknowledge // 
// the source and its authors.						  //
//                                                    //
//----------------------------------------------------//
#version 330 core

layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 color;
layout(location = 3) in vec2 texcoord0;
layout(location = 4) in vec2 texcoord1;
layout(location = 5) in vec3 tangent;

uniform mat4 uniform_model;

out vec3 vertex_normal;
out vec3 vertex_tangent;
out vec2 vertex_texcoord0;
out vec2 vertex_texcoord1;
out vec4 vertex_color;

void main(void)
{
	vertex_normal = (uniform_model * vec4(normal,0)).xyz;
	vertex_tangent = (uniform_model * vec4(tangent,0)).xyz;
  
   vertex_texcoord0 = texcoord0;
   vertex_texcoord1 = texcoord1;

   vertex_color = color;

   gl_Position = uniform_model * vec4(position,1);
}
