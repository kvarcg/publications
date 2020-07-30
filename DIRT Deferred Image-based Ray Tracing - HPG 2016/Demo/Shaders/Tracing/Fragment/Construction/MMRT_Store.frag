// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the Store pass
// Incoming primitives are allocated to their corresponding bucket and stored in the ID and Data buffers

#include "version.h"
#include "MMRT/MMRT_data_structs.glsl"
#include "trace_define.h"

#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1

uniform sampler2D sampler_color;						// textures, material samplers and uniforms
uniform sampler2D sampler_bump;
uniform sampler2D sampler_specular;
uniform sampler2D sampler_emission;
uniform sampler2D sampler_opacity;

uniform uint	uniform_texture_mask;
uniform vec4	uniform_material_color;
uniform float	uniform_reflectance;
uniform vec3	uniform_emission;
uniform float	uniform_gloss;
uniform float	uniform_metallic;
uniform vec3	uniform_ior;
uniform int		uniform_lighting_buffer_enabled;
uniform vec2	uniform_near_far[7];

in vec3 Necs;											// incoming vertex data from the geometry shader
in vec3 Tecs;
in vec3 Becs;
in vec2 TexCoord;
in vec4 vertex_color;
in float pecsZ;
flat in int uniform_cube_index;

layout(binding = 0, r32ui)		coherent uniform uimage2DArray image_head_tail;						// stored head pointers per view and per bucket and then tail pointers in the same manner
layout(binding = 1, std430)		coherent buffer  LL_DATA	 { NodeTypeData			data []; };		// the Data buffer
layout(binding = 2, std430)		coherent buffer  LLD_NODES	 { NodeTypeLL_Double	nodes[]; };		// the ID buffer
layout(binding = 3, offset = 0)		   uniform atomic_uint		  next_address;						// the next address counter for the ID and Data buffers
layout(binding = 11) uniform sampler2DArray tex_depth_bounds;										// the depth bounds

// set the incoming value as the head and the returned value as the next pointer
uint  exchangePixelCurrentPageID(const int  b, const uint val)	{ return imageAtomicExchange(image_head_tail, ivec3(gl_FragCoord.xy, b), val);}

#include "normal_compression.h"

void main(void)
{	
	// fetch incoming data, perform texture fetches, etc
	uint hasalb		= (uniform_texture_mask & 0x01u) >> 0u;
	vec4 tex_color	= (hasalb > 0u) ? texture(sampler_color, TexCoord.st) : vec4(1);

	// opacity map fetches
	uint hasop		= (uniform_texture_mask & 0x10u) >> 4u;
	float opacity_map = (hasop > 0u) ? texture(sampler_opacity, TexCoord.st).x : 0.0;
	if (tex_color.a < 0.5 || opacity_map == 1.0) return;

	uint hasbump = (uniform_texture_mask & 0x02u) >> 1u;
	uint hasspec = (uniform_texture_mask & 0x04u) >> 2u;
	uint hasemis = (uniform_texture_mask & 0x08u) >> 3u;

	// bump map fetches
	vec4 nmap = vec4(0);
	float heigh_prev_U = 0;
	float heigh_prev_V = 0;

	if (hasbump > 0u)
	{
		nmap = texture(sampler_bump, TexCoord.st);
		heigh_prev_U = textureOffset(sampler_bump, TexCoord.st,ivec2(-1,0)).r;
		heigh_prev_V = textureOffset(sampler_bump, TexCoord.st,ivec2(0,-1)).r;
	}
		
	// emission map fetches
	vec4 emission_map = (hasemis > 0u) ? texture(sampler_emission, TexCoord.st) : vec4(0);

	// specular map fetches
	vec4 specular_map = (hasspec > 0u) ? texture(sampler_specular, TexCoord.st) : vec4(0);

	// increase the counter in the list to find next address
	uint index = atomicCounterIncrement(next_address) + 1U;
	if (index >= nodes.length()) return;

	vec4 tex_comb = uniform_material_color * vertex_color * tex_color;
	if (uniform_lighting_buffer_enabled > 0)
		tex_comb.rgb = vec3(1);
	
	vec4 out_albedo = vec4(0);
	out_albedo.rgb = tex_comb.rgb;
	
	// emission
	float em = (uniform_emission.x+uniform_emission.y+uniform_emission.z)/3.0;
	if (hasemis > 0u)
	{
		em *= emission_map.r;
	}
	float emission_mult = 0.0;
	if (em <= 1.0)
		out_albedo.a = em;
	else
	{
		emission_mult = 1.0;
		out_albedo.a = em / EMISSION_MULT;
	}

	// normal
	vec3 newN = Necs;
#ifdef NORMAL_MAPS
	if (hasbump > 0u)
	{
		newN += -2.0*(Tecs*(nmap.r-heigh_prev_U) + Becs*(nmap.r-heigh_prev_V));
	}
#endif // NORMAL_MAPS
	newN = normalize(newN);
	vec2 out_normal = vec2(0);
	out_normal.xy = normal_encode_spheremap1(newN);

	vec4 spec_coefs = vec4(uniform_reflectance, uniform_gloss, uniform_metallic, 1.0);
	if (hasspec > 0u)
	{
		spec_coefs = specular_map;		
	}
	vec4 out_specular = spec_coefs;
	
	vec4 out_ior_opacity = vec4(uniform_ior.x/10.0, uniform_material_color.a, emission_mult, 0);

	// find the bucket that contains the fragment
#ifdef USE_BUCKETS		
	vec2	depths		= texelFetch(tex_depth_bounds, ivec3(gl_FragCoord.xy, uniform_cube_index), 0).rg;
	float	depth_near	= -depths.r;
	float	depth_far	=  depths.g;

	float Z = -pecsZ;
	float	normalized_depth = (Z - depth_near)/(depth_far - depth_near);
	normalized_depth	= clamp(normalized_depth, 0.0, 1.0);
	int		bucket		= int(floor(float(BUCKET_SIZE)*normalized_depth));
	bucket				= min(bucket,BUCKET_SIZE_1n);	
#else
	int bucket = 0;	
#endif
	bucket				= uniform_cube_index * BUCKET_SIZE + bucket;

	// store the information in the ID and Data buffers
	nodes[index].depth		= pecsZ;
	nodes[index].prev		= 0u;
	nodes[index].next		= exchangePixelCurrentPageID(bucket, index);

	data[index].albedo		= packUnorm4x8(out_albedo);
	data[index].normal		= packUnorm2x16(out_normal);
	data[index].specular	= packUnorm4x8(out_specular);	
	// ior is set to zero of the object is opaque
	data[index].ior_opacity = packUnorm4x8(out_ior_opacity);
}