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
uniform mat4 uniform_mv;
uniform mat4 uniform_normal_matrix;

out vec3 vertex_position_ecs;
out vec4 vertex_color;
out vec3 vertex_normal_ecs;
out vec2 TexCoord;

vec3 NormalOCS2ECS(in vec3 v_wcs)
{
	vec4 v_ecs = uniform_normal_matrix * vec4(v_wcs,0);
	return v_ecs.xyz;
}

vec3 PointOCS2ECS(in vec3 p_ocs)
{
	vec4 p_ecs = uniform_mv * vec4(p_ocs,1);
	return p_ecs.xyz;
}

void main(void)
{
   gl_Position = uniform_mvp * vec4(position,1);
   
   vertex_position_ecs = PointOCS2ECS(position);
   vertex_color = color;   
   vertex_normal_ecs = NormalOCS2ECS(normal);
   TexCoord = texcoord0;
}
