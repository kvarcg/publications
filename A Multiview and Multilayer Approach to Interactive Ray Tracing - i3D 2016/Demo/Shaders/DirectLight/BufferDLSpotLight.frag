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
in vec2 TexCoord;
uniform sampler2D sampler_albedo;
uniform sampler2D sampler_normal;
uniform sampler2D sampler_specular;
uniform sampler2D sampler_occlusion;
uniform sampler2D sampler_depth;
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

uniform mat4 uniform_view;
uniform mat4 uniform_proj_inverse;
uniform mat4 uniform_view_inverse;
uniform mat4 uniform_light_view;
uniform mat4 uniform_light_projection;
uniform mat4 uniform_light_projection_inverse;

#include "normal_compression.h"
#include "depth_reconstruction.h"
#include "microfacet_direct_lighting.h"
#include "spotlight.h"
#include "shadow_mapping.h"

void main(void)
{
	float current_depth = texture(sampler_depth, TexCoord.xy).r;
	if (current_depth == 1.0) 
	{
		out_color = vec4(0,0,0,1); return;
	}
	
	vec4 kd = texture(sampler_albedo, TexCoord.xy);
	vec2 normal_packed = texture(sampler_normal, TexCoord.xy).xy;
	vec3 normal_unclamped = normal_decode_spheremap1(normal_packed.rg);

	vec4 specular_params = texture(sampler_specular, TexCoord.xy);

	vec4 occlusion = texture(sampler_occlusion, TexCoord.xy);
	//vec3 normal_bent_unclamped = normal_unpack_xy(occlusion.rgb);

	vec3 pecs = reconstruct_position_from_depth(TexCoord.xy, texture(sampler_depth, TexCoord.xy).r);

	vec3 light_position_ecs = (uniform_view * vec4(uniform_light_position, 1)).xyz;
	vec3 vertex_to_light_direction_ecs = light_position_ecs - pecs.xyz;
	float dist2 = dot(vertex_to_light_direction_ecs,vertex_to_light_direction_ecs);

	// normalize vertex to light direction vector
	vertex_to_light_direction_ecs = normalize(vertex_to_light_direction_ecs);

	// check spotlight cutoff between light-to-vertex and spotlight direction
	float spoteffect = check_spotlight(uniform_view, vertex_to_light_direction_ecs);	
	
	vec3 vertex_to_view_direction = -normalize(pecs.xyz);

	vec3 dirColor = MicrofacetBRDF(vertex_to_view_direction.xyz, vertex_to_light_direction_ecs.xyz, normal_unclamped.xyz, kd.rgb, specular_params.xyz) * uniform_light_color.rgb  * spoteffect/dist2;

	float shadowFactor = 1; 
	if (uniform_shadows_enabled) shadowFactor = shadow(pecs);
	dirColor *= shadowFactor;
	dirColor *= occlusion.a * occlusion.a;

	out_color = vec4(dirColor,1);	
}