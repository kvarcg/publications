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
#version 430 core
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;

uniform sampler2D sampler_depth;
uniform sampler2D sampler_color;

uniform mat4 uniform_proj_inverse;
uniform vec3 uniform_start_color;
uniform vec3 uniform_end_color;
uniform float uniform_start_distance;
uniform float uniform_end_distance;

#include "depth_reconstruction.h"
void main(void)
{
	vec4 color = texture(sampler_color, TexCoord.xy);
	float depth = texture(sampler_depth, TexCoord.xy).r;
	vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, depth);
	float pecs_dist = length(pecs);

	float start = uniform_start_distance;
	float end = uniform_end_distance;
	float fog = (pecs_dist - start) / (end - start);

	// do not completely replace the sky color
	fog = clamp(fog, 0.0, 0.8);
	
	vec3 fog_color = mix(uniform_start_color, uniform_end_color, fog);

	vec3 final_color = mix(color.rgb, fog_color, fog);

	out_color = vec4(final_color.rgb, 1);
}
