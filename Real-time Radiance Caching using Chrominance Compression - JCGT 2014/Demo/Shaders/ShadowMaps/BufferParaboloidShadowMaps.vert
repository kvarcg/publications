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
uniform mat4 uniform_light_view;
uniform mat4 uniform_T0;
uniform mat4 uniform_T1;
uniform float uniform_near;
uniform float uniform_far;

out vec4 pwcs;
out vec4 pecs;
out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec4[2] TexCoord;
out vec4 vertex_color;

void main(void)
{
   mat4 VM = uniform_light_view * uniform_model;
   Necs = normalize((VM * vec4(normal,0)).xyz);
   Tecs = normalize((VM * vec4(tangent,0)).xyz);
   Becs = cross(Necs,Tecs);

   pwcs = uniform_model * vec4(position,1);
   pecs = uniform_light_view * pwcs;
   TexCoord[0] = uniform_T0*vec4(texcoord0.x,texcoord0.y,0,1);
   TexCoord[1] = uniform_T1*vec4(texcoord1.x,texcoord1.y,0,1);

   vertex_color = color;

   vec4 out_position = VM * vec4(position,1);
   float fLength = length(out_position.xyz);
   out_position = out_position / fLength;

   out_position.x /= -out_position.z + 1.0;
   out_position.y /= -out_position.z + 1.0;
   out_position.z = (fLength - uniform_near) / (uniform_far - uniform_near);
   out_position.w = 1.0;

   gl_Position = out_position;
}
