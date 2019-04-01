// DIRT: Deferred Image-based Ray Tracing (HPG 2016)
// http://diglib.eg.org/handle/10.2312/hpg20161193
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the fragment implementation for the Fetch pass
// For each rasterized primitive, the hit buffer is iterated and checked for equality.
// On each successful comparison, the hit record is fetched where (i) the barycentric coordinates are used to interpolate the shading information
// and (ii) the interpolated information is stored at G[k+2] location of the shading buffer. This location is stored in the hit record as well (the variable's name is owner).
// It is practically the pixel location on which the tracing started.

#include "version.h"
#include "DIRT/DIRT_data_structs.glsl"
#include "trace_define.h"

#ifdef DEPTH_MASK
layout (early_fragment_tests) in;								// the bound depth mask is used here a pixel rejection mechanism
#endif

#define NUM_MEMORY_CUBEMAPS		__NUM_FACES__
#define BUCKET_SIZE				__BUCKET_SIZE__
#define BUCKET_SIZE_1n			BUCKET_SIZE - 1
#define NUM_CUBEMAPS			__NUM_FACES__

uniform sampler2D sampler_color;								// textures, material samplers and uniforms
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
in float pecsZ;

flat in int uniform_cube_index;					  // the view index from the geometry shader
flat in uint primitive_id;						  // the incoming primitive id from the geometry shader
uniform mat4 uniform_mv[NUM_CUBEMAPS];			  // object->eye transformation for all views

// image bindings
layout(binding = 1, r32ui )		coherent uniform uimage2DArray		image_hit_buffer_head;							  // the hit buffer head id texture
layout(binding = 2, std430)		coherent buffer  LLD_SHADING	 { NodeTypeShading		nodes_shading []; };		  // the shading buffer
layout(binding = 4, std430)		coherent buffer  LLD_HIT		 { NodeTypeHit			nodes_hit[]; };				  // the hit buffer
layout(binding = 5, std430)		coherent buffer  LLD_PRIMITIVE	 { NodeTypePrimitive	nodes_primitives[]; };		  // the vertex buffer

#define PEEL_HEAD_LAYER 0
// gets the hit buffer head for the current pixel
uint  getHitBufferHeadID		(const ivec2 coords)				 { return imageLoad (image_hit_buffer_head, ivec3(coords, PEEL_HEAD_LAYER)).x; }

#include "normal_compression.h"

in mat4 m_inv;

void main(void)
{	
	uint hasalb		= (uniform_texture_mask & 0x01u) >> 0u;
	//
	uint hasbump = (uniform_texture_mask & 0x02u) >> 1u;
	uint hasspec = (uniform_texture_mask & 0x04u) >> 2u;
	uint hasemis = (uniform_texture_mask & 0x08u) >> 3u;
	uint hasop	 = (uniform_texture_mask & 0x10u) >> 4u;	

	// bump map fetches
	vec4 nmap = vec4(0);
	float heigh_prev_U = 0;
	float heigh_prev_V = 0;

	uvec2 dimensions = uvec2(imageSize(image_hit_buffer_head).xy);

	vec2 vTexCoord[3];
	vec3 vposition[3];
	vec3 vnormal[3];
	vec3 vtangent[3];
	vec4 vvertex_color[3];

	vec4 spec_coefs = vec4(uniform_reflectance, uniform_gloss, uniform_metallic, 1.0);
	//vec4 spec_coefs = vec4(uniform_reflectance, uniform_gloss, 0, 1.0);
	uint	albedo		= 0u;
	uint	normal		= 0u;
	uint	specular	= 0u;
	uint	ior_opacity = 0u;
	vec4	position	= vec4(0);
	vec3 position_ecs	= vec3(0);
	vec2 texuv			= vec2(0);
	vec4 color			= vec4(0);
	vec3 normal_ecs		= vec3(0);
	vec3 tangent_ecs	= vec3(0);
	int view			= int(0);
	vec3 bitangent_ecs	= vec3(0);
	vec4 tex_color		= vec4(0);
	vec4 emission_map	= vec4(0);
	vec4 specular_map	= vec4(0);	
	vec4 tex_comb		= vec4(0);
	vec4 out_albedo		= vec4(0);
	float em			= 0.0;
	float emission_mult = 0.0;
	vec3 newN			= vec3(0);
	vec2 out_normal		= vec2(0);
	vec4 out_specular	= vec4(0);
	vec4 out_ior_opacity = vec4(0);

	nmap = texture(sampler_bump, TexCoord.st);
	heigh_prev_U = textureOffset(sampler_bump, TexCoord.st,ivec2(-1,0)).r;
	heigh_prev_V = textureOffset(sampler_bump, TexCoord.st,ivec2(0,-1)).r;
			
	// get the head of the id buffer
	// when the mask texture is employed, this shound never be null (0u)
	uint index = getHitBufferHeadID(ivec2(gl_FragCoord.xy));
	int iter = 0;
	while(index > 0u && iter < 1000)
	{
		++iter;
		// extract the primitive id and the cubeindex
		uvec2 prim_id_cube = unpack_prim_id_cubeindex(nodes_hit[index].primitive_id);
		ivec2 owner			= ivec2(nodes_hit[index].owner);
		
		float loaded = nodes_hit[index].extra_data.x;
		
		if (prim_id_cube.x == primitive_id 
		&& int(prim_id_cube.y) == uniform_cube_index
		&& loaded > -1.0)
		{
			nodes_hit[index].extra_data.x = -1.0;

			// aqcuire the barycentric coordinates
			vec3 barycentric = vec3(nodes_hit[index].extra_data.zw,0.0);
			barycentric.z = 1.0 - barycentric.x - barycentric.y;

			// retrieve the primitive information from the vertex buffer (in object space)
			NodeTypePrimitive prim = nodes_primitives[primitive_id];
			vposition[0] = vec3(m_inv * vec4(prim.vertex1.xyz, 1.0)).xyz;
			vposition[1] = vec3(m_inv * vec4(prim.vertex2.xyz, 1.0)).xyz;
			vposition[2] = vec3(m_inv * vec4(prim.vertex3.xyz, 1.0)).xyz;
			vnormal[0] = vec3(prim.vertex1.w, prim.vertex2.w, prim.vertex3.w);
			vnormal[1] = prim.normal2_tangent1x.xyz;
			vnormal[2] = prim.normal3_tangent1y.xyz;
			vtangent[0] = vec3(prim.normal2_tangent1x.w, prim.normal3_tangent1y.w, prim.tangent2_tangent1z.w);
			vtangent[1] = prim.tangent2_tangent1z.xyz;
			vtangent[2] = prim.tangent3.xyz;
			vTexCoord[0] = prim.texcoord1_texcoord2.xy;
			vTexCoord[1] = prim.texcoord1_texcoord2.zw;
			vTexCoord[2] = prim.texcoord3.xy;
			
			// get the interpolated values
			position_ecs	= vposition[0]*		barycentric.z + vposition[1]*		barycentric.x + vposition[2]*		barycentric.y;
			texuv			= vTexCoord[0]*		barycentric.z + vTexCoord[1]*		barycentric.x + vTexCoord[2]*		barycentric.y;
			color			= vvertex_color[0]*	barycentric.z + vvertex_color[1]*	barycentric.x + vvertex_color[2]*	barycentric.y;
			normal_ecs		= vnormal[0]*		barycentric.z + vnormal[1]*			barycentric.x + vnormal[2]*			barycentric.y;
			tangent_ecs		= vtangent[0]*		barycentric.z + vtangent[1]*		barycentric.x + vtangent[2]*		barycentric.y;

			// convert any required values to eye space
			view			= int(prim_id_cube.y);
			position_ecs	= vec3(uniform_mv[view] * vec4(position_ecs,1)).xyz;
			normal_ecs		= normalize ((uniform_mv[view] * vec4(normal_ecs,0)).xyz);
			tangent_ecs		= normalize ((uniform_mv[view] * vec4(tangent_ecs,0)).xyz);
			bitangent_ecs	= cross(normal_ecs,tangent_ecs);

			// perform texture fetches
			tex_color		= (hasalb > 0u) ? texture(sampler_color, texuv.st) : vec4(1);

			// opacity map fetches
			float opacity_map = (hasop > 0u) ? texture(sampler_opacity, texuv.st).x : 0.0;
			if (tex_color.a < 0.5 || opacity_map == 1.0) 
			{
				//index	= nodes_hit[index].next;
				//continue;
			}

			// bump map fetches
			if (hasbump > 0u)
			{
				nmap = texture(sampler_bump, texuv.st);
				heigh_prev_U = textureOffset(sampler_bump, texuv.st,ivec2(-1,0)).r;
				heigh_prev_V = textureOffset(sampler_bump, texuv.st,ivec2(0,-1)).r;
			}
		
			// emission map fetches
			emission_map = (hasemis > 0u) ? texture(sampler_emission, texuv.st) : vec4(0);

			// specular map fetches
			specular_map = (hasspec > 0u) ? texture(sampler_specular, texuv.st) : vec4(0);
	
			tex_comb = uniform_material_color * tex_color;
			if (uniform_lighting_buffer_enabled > 0) tex_comb.rgb = vec3(1);
	
			out_albedo = vec4(0);
			out_albedo.rgb = tex_comb.rgb;
	
			// emission
			em = (uniform_emission.x+uniform_emission.y+uniform_emission.z)/3.0;
			if (hasemis > 0u)
			{
				em *= emission_map.r;
			}
			emission_mult = 0.0;
			if (em <= 1.0)
				out_albedo.a = em;
			else
			{
				emission_mult = 1.0;
				out_albedo.a = em / 1000.0;
			}

			// normal
			newN = normal_ecs;
#ifdef NORMAL_MAPS
			if (hasbump > 0u)
			{
				normal_ecs += -2.0*(tangent_ecs*(nmap.r-heigh_prev_U) + bitangent_ecs*(nmap.r-heigh_prev_V));
			}
#endif // NORMAL_MAPS				
			newN = normalize(newN);
			out_normal = vec2(0);
			out_normal.xy = normal_encode_spheremap1(newN);

			if (hasspec > 0u)
			{
				spec_coefs = specular_map;		
			}

			position	= vec4(0,0, pecsZ, 0);

			// store these values in the second position of shading data buffer
			uint  resolve_index = uint(owner.y * dimensions.x + owner.x) * 3u + 2u;

#ifdef NO_PACKING
			nodes_shading[resolve_index].albedo			= vec4(out_albedo.rgb, uniform_material_color.a);
			nodes_shading[resolve_index].normal_em		= vec4(newN, em);
			nodes_shading[resolve_index].specular_ior	= vec4(spec_coefs.xyz, uniform_ior.x);
			// mark the hit as loaded
			nodes_shading[resolve_index].extra			= vec4(2,0,0,0);
#else
			// mark the hit as loaded
			out_ior_opacity = vec4(uniform_ior.x / 10.0, uniform_material_color.a, emission_mult, 1.0);
			spec_coefs.w = NO_TRANSMISSION;
			out_specular = spec_coefs;
			albedo		= packUnorm4x8(out_albedo);
			normal		= packUnorm2x16(out_normal);
			specular	= packUnorm4x8(out_specular);
			ior_opacity = packUnorm4x8(out_ior_opacity);

			// store these values in the first position of ssbo data buffer
			nodes_shading[resolve_index].albedo	  = albedo;
			nodes_shading[resolve_index].normal	  = normal;
			nodes_shading[resolve_index].specular = specular;
			// ior is set to zero of the object is opaque
			// scale ior to be below 1.0
			nodes_shading[resolve_index].ior_opacity = ior_opacity; 
#endif // NO_PACKING
			uint prid_cube_mask = pack_prim_id_cubeindex(primitive_id, view);
			// the last channel stores the cube index
			position.w = uintBitsToFloat(prid_cube_mask);
			// TODO: this should be the accurate hit point		
			//position.xy = nodes_hit[index].extra_data.xy;
			position.xyz = position_ecs.xyz;
			nodes_shading[resolve_index].position = position;		
		}
		index	= nodes_hit[index].next;
	}
}