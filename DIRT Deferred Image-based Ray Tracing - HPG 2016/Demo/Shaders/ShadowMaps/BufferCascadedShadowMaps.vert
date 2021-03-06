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

uniform mat4 uniform_light_normal_matrix;
uniform mat4 uniform_model;
uniform mat4 uniform_light_view;
uniform mat4 uniform_T0;
uniform mat4 uniform_T1;

out vec3 v_Necs;
out vec3 v_Tecs;
out vec3 v_Becs;
out vec2 v_texcoord0;
out vec2 v_texcoord1;
out vec4 v_color;

void main(void)
{
	v_Necs = normalize ((uniform_light_normal_matrix * vec4(normal,0)).xyz );
	v_Tecs = normalize ((uniform_light_normal_matrix * vec4(tangent,0)).xyz );
	v_Becs = cross(v_Necs,v_Tecs);
  
	v_texcoord0 = vec2(uniform_T0*vec4(texcoord0.x,texcoord0.y,0,1)).xy;
	v_texcoord1 = vec2(uniform_T1*vec4(texcoord1.x,texcoord1.y,0,1)).xy;

	v_color = color;

	gl_Position = uniform_light_view * uniform_model * vec4(position,1);
}
