// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the optional Direct Visibility pass
// This is a standard rasterization pass. However, since it is stored in the shading buffer and a Z-buffer is not available at the current implementation,
// a spinlock mechanism is used. In an NVIDIA Maxwell architecture, the GL_NV_fragment_shader_interlock can be used. This is not a requirement though.
// Note: This pass should NOT use conservative rasterization due to attribute extrapolation
// Note 2: There is a chance that the spinlock mechanism will cause a deadlock on NVIDIA GPUs.

#include "version.h"
#include "trace_define.h"
#if CONSERVATIVE == 1
#define NV_INTERLOCK
#endif // CONSERVATIVE
#ifdef	NV_INTERLOCK
#extension GL_NV_fragment_shader_interlock : enable
#endif

#include "DIRT/DIRT_data_structs.glsl"

#define NUM_CUBEMAPS			__NUM_FACES__
#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1

uniform sampler2D sampler_color;				// textures, material samplers and uniforms
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

in vec3 Necs;									// incoming vertex data from the geometry shader
in vec3 Tecs;
in vec3 Becs;
in vec2 TexCoord;
in vec4 vertex_color;
in vec3 pecs;

flat in int		uniform_cube_index;				// the view index
flat in uint	primitive_id;					// the primitive id
flat in vec4	prim_vertex_wcs[3];				// the incoming vertex positions from the geometry shader
uniform vec4	uniform_viewports[1];			// the viewport dimensions

layout(binding = 1, std430)		coherent buffer  LL_DATA	 { NodeTypeShading			nodes_shading []; }; // the shading buffer
layout(binding = 5, r32ui)		coherent uniform uimage2DArray semaphore;									 // the spinlock texture

layout(binding = 11) uniform sampler2DArray tex_depth_bounds;

#include "normal_compression.h"

void main(void)
{

#ifndef	NV_INTERLOCK
	return;
#endif

	// fetch incoming data, perform texture fetches, etc
	uint hasalb		= (uniform_texture_mask & 0x01u) >> 0u;
	vec4 tex_color	= (hasalb > 0u) ? texture(sampler_color, TexCoord.st) : vec4(1);

	// opacity map fetches
	uint hasop		= (uniform_texture_mask & 0x10u) >> 4u;
	float opacity_map = (hasop > 0u) ? texture(sampler_opacity, TexCoord.st).x : 0.0;

	bool should_cull = tex_color.a < 0.5 || opacity_map == 1.0;

#ifndef	NV_INTERLOCK
	if(should_cull) return;
#endif

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
#ifdef NO_PACKING
	out_albedo.a = em;
#else
	if (em <= 1.0)
		out_albedo.a = em;
	else
	{
		emission_mult = 1.0;
		out_albedo.a = em / EMISSION_MULT;
	}
#endif

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
	spec_coefs.w = NO_TRANSMISSION;
	vec4 out_specular = spec_coefs;
	
	ivec2 coord = ivec2(gl_FragCoord.xy);
	vec4 out_ior_opacity = vec4(uniform_ior.x / 10.0, uniform_material_color.a, emission_mult, 1.0);
	
	uint	albedo		= packUnorm4x8(out_albedo);
	uint	normal		= packUnorm2x16(out_normal);
	uint	specular	= packUnorm4x8(out_specular);
	uint	ior_opacity = packUnorm4x8(out_ior_opacity);
	vec4	position	= vec4(gl_FragCoord.xy, float(pecs.z), 0);
	uvec2	dimensions = uvec2(uniform_viewports[0].zw);
	uvec2	frag = uvec2(floor(gl_FragCoord.xy));

	// store each 3-point pair sequentially. the current point is stored at G1, serving as the ray start direction
	uint resolve_index = int(frag.y * dimensions.x + frag.x) * 3 + 2u;
	
#ifdef NV_INTERLOCK
	beginInvocationInterlockNV();
	bool shouldLock = !should_cull;// && uniform_cube_index == 0;
	if (shouldLock)
	{
		uint d = floatBitsToUint(pecs.z);
		if (imageAtomicMin(semaphore, ivec3(gl_FragCoord.xy, 1), d) >= d)
		{
			//<critical section>
			// store these values in the first position of ssbo data buffer
#ifdef NO_PACKING
			nodes_shading[resolve_index].albedo			= vec4(out_albedo.rgb, uniform_material_color.a);
			nodes_shading[resolve_index].normal_em		= vec4(newN, out_albedo.a);
			nodes_shading[resolve_index].specular_ior	= vec4(spec_coefs.xyz, 0);
			nodes_shading[resolve_index].extra			= vec4(1,0,0,0);
#else
			nodes_shading[resolve_index].albedo	  = albedo;
			nodes_shading[resolve_index].normal	  = normal;
			nodes_shading[resolve_index].specular = specular;
			// ior is set to zero of the object is opaque
			// scale ior to be below 1.0
			nodes_shading[resolve_index].ior_opacity = ior_opacity; 
#endif // NO_PACKING
			uint prid_cube_mask = pack_prim_id_cubeindex(primitive_id, 0);
			position.w = uintBitsToFloat(prid_cube_mask);
			nodes_shading[resolve_index].position = position;	
			nodes_shading[resolve_index].position.xyz = pecs;
		}
	}
	endInvocationInterlockNV();
#endif // NV_INTERLOCK

}