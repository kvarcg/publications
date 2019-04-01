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
uniform sampler2D sampler_albedo;
uniform sampler2D sampler_occlusion;
uniform sampler2D sampler_depth;
uniform vec3 uniform_ambient_light_color;
uniform vec3 uniform_background_color;
uniform mat4 uniform_view_inverse;

vec2 normal_encode_xy(vec2 normal)
{
	return vec2(0.5 + normal.xy * 0.5);
}

vec2 normal_decode_xy(vec2 normal)
{
	return vec2(2.0 * normal.xy - 1.0);
}

void main(void)
{
	float current_depth = texture2D(sampler_depth, TexCoord.xy).r;
	vec4 kd = texture2D(sampler_albedo, TexCoord.xy);
	vec4 occlusion = texture2D(sampler_occlusion, TexCoord.xy);
	vec4 bent_normal_wcs = uniform_view_inverse * vec4(normal_decode_xy(occlusion.xy), occlusion.z, 0.0);

	vec3 env = mix(0.5 * uniform_ambient_light_color, 1.5 * (uniform_ambient_light_color + vec3(0.01, 0.03, 0.08)), normal_encode_xy(bent_normal_wcs.xy).y);
	//vec3 env = mix(0.5 * uniform_ambient_light_color, 1.5 * (uniform_ambient_light_color + vec3(0.01, 0.03, 0.08)), occlusion.y);
	
	vec3 ambColor = (current_depth == 1.0) ? uniform_background_color : kd.rgb * occlusion.a * uniform_ambient_light_color;

	out_color = vec4(ambColor.rgb + kd.xyz*(1-kd.w), 1);	

	//out_color = vec4(ambColor.rgb * max(0.0, bent_normal_wcs.y) + kd.xyz*(1-kd.w), 1);
}
