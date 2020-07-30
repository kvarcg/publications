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
layout(location = 6) in vec4 vertexWeight;
layout(location = 7) in ivec4 boneIdx;

#define BONE_NUM __MAX_BONES__

uniform mediump mat4 transforms[__MAX_BONES__];
uniform 		bool uniform_has_bones;

uniform mat4 uniform_light_normal_matrix;
uniform mat4 uniform_model;
uniform mat4 uniform_light_view;
uniform float uniform_near;
uniform float uniform_far;
uniform mat4 uniform_T0;
uniform mat4 uniform_T1;

out vec4 pwcs;
out vec4 pecs;
out vec3 Necs;
out vec3 Tecs;
out vec3 Becs;
out vec2[2] TexCoord;
out vec4 vertex_color;

void main(void)
{
	mat4 ecsPTBN = mat4(
		vec4(position, 				 1.0),
		vec4(tangent,  				 0.0),
		vec4(cross(normal, tangent), 0.0),
		vec4(normal, 				 0.0));
		
	if(uniform_has_bones)
	{
		mat4 PTBN = ecsPTBN;
		ecsPTBN = mat4(0.0);
		
		ecsPTBN += transforms[boneIdx.x] * PTBN * vertexWeight.x;
		ecsPTBN += transforms[boneIdx.y] * PTBN * vertexWeight.y;
		ecsPTBN += transforms[boneIdx.z] * PTBN * vertexWeight.z;
		ecsPTBN += transforms[boneIdx.w] * PTBN * vertexWeight.w;
	}
   
   Tecs = normalize (( uniform_light_normal_matrix * ecsPTBN[1] ).xyz );
   Becs = normalize (( uniform_light_normal_matrix * ecsPTBN[2] ).xyz );
   Necs = normalize (( uniform_light_normal_matrix * ecsPTBN[3] ).xyz );

   pwcs = uniform_model * ecsPTBN[0];
   pecs = uniform_light_view * pwcs;
   TexCoord[0] = vec2(uniform_T0*vec4(texcoord0.x,texcoord0.y,0,1)).xy;
   TexCoord[1] = vec2(uniform_T1*vec4(texcoord1.x,texcoord1.y,0,1)).xy;

   vertex_color = color;

   vec4 out_position = uniform_light_view * uniform_model * ecsPTBN[0];
   float fLength = length(out_position.xyz);
   out_position = out_position / fLength;

   out_position.x /= -out_position.z + 1.0;
   out_position.y /= -out_position.z + 1.0;
   out_position.w = -sign(out_position.z);
   out_position.z = (fLength - uniform_near) / (uniform_far - uniform_near);

   gl_Position = out_position;
}
