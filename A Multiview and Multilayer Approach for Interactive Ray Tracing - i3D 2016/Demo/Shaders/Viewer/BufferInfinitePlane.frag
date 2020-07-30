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

layout(location = 0) out vec4 out_color;

uniform sampler2D uniform_sampler_color;
uniform vec4 uniform_material_color;

in vec2 texcoord;
in vec3 pwcs;

uniform sampler2D sampler_noise;
uniform sampler2D sampler_shadow_map;
uniform vec3 uniform_light_color;
uniform vec3 uniform_light_position;
uniform vec3 uniform_light_direction;
uniform int uniform_light_is_conical;
uniform float uniform_light_cosine_umbra;
uniform float uniform_light_cosine_penumbra;
uniform float uniform_spotlight_exponent;
uniform float uniform_light_size;
uniform float uniform_shadow_map_resolution;
uniform bool uniform_shadows_enabled;
uniform vec2 uniform_samples[16];
uniform float uniform_constant_bias;
uniform mat4 uniform_view_inverse;
uniform mat4 uniform_light_view;
uniform mat4 uniform_light_projection;
uniform mat4 uniform_light_projection_inverse;

#include "shadow_mapping.h"

void main(void)
{
	vec4 material_color = vec4(0.2,0.2,0.2,1);

	material_color = texture(uniform_sampler_color, texcoord);
	material_color.rgb -= vec3(0.1);
	float shadowFactor = 1;
	
	shadowFactor = shadowWCS(pwcs);

	out_color = material_color;
	if (shadowFactor < 1)
	{
		shadowFactor = max(0.6, shadowFactor);
		out_color.rgb *= vec3(shadowFactor);
	}
	out_color.a = material_color.a;
}
