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

uniform mat4 uniform_mv;
uniform mat4 uniform_mvp;
uniform mat4 uniform_mvp_prev;
uniform mat4 uniform_T0;
uniform mat4 uniform_T1;

out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec4 curpos;
out vec4 prev;
out vec4[2] TexCoord;
out vec4 vertex_color;

void main(void)
{
   Necs = normalize ((uniform_mv * vec4(normal,0)).xyz );
   Tecs = normalize ((uniform_mv * vec4(tangent,0)).xyz );
   Becs = cross(Necs,Tecs);

   gl_Position = uniform_mvp * vec4(position,1);
   prev = uniform_mvp_prev * vec4(position,1);
   curpos = gl_Position;
   TexCoord[0] = uniform_T0*vec4(texcoord0.xy,0,1);
   TexCoord[1] = uniform_T1*vec4(texcoord1.xy,0,1);

   vertex_color = color;
}
