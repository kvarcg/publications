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
layout(location = 0) out vec4 out_color;
in vec2 TexCoord;

uniform sampler2D sampler_depth;
uniform sampler2D sampler_color;

uniform mat4 uniform_proj_inv;
uniform vec3 uniform_start_color;
uniform vec3 uniform_end_color;
uniform float uniform_start_distance;
uniform float uniform_end_distance;

vec3 reconstruct_position_from_depth()
{
	vec4 pndc = vec4(2 * vec3(TexCoord.xy, texture(sampler_depth, TexCoord.xy).r) - 1, 1);
	vec4 pecs = uniform_proj_inv * pndc;
	pecs.xyz = pecs.xyz/pecs.w;
	return pecs.xyz;
}

void main(void)
{
	vec4 color = texture(sampler_color, TexCoord.xy);
	float pecs_dist = length(reconstruct_position_from_depth());
	
	
	/*float fog = (pecs_dist - 1) / (400 - 1);
	fog = clamp(fog, 0.0, 1.0);
	fog *= fog * 1 * 1;

	vec3 fog_color = mix(vec3(0.4, 0.3, 0.12) * 0.3, vec3(0.3, 0.22, 0.12), fog);
	*/

	float fog = (pecs_dist - uniform_start_distance) / (uniform_end_distance - uniform_start_distance);
	fog = clamp(fog, 0.0, 1.0);
	
	vec3 fog_color = mix(uniform_start_color, uniform_end_color, fog);

	vec3 final_color = mix(color.rgb, fog_color, fog);

	out_color = vec4(final_color.rgb, color.a);
}
