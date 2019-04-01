// Real-time Radiance Caching using Chrominance Compression (JCGT)
// http://jcgt.org/published/0003/04/06/
// Authors: K. Vardis, G. Papaioannou, A. Gkaravelis
// This file contains the fragment implementation for the occupancy optimization stage

#version 420 core

layout(binding = 0) uniform atomic_uint occupied_voxels_atomic_counter;
//layout(binding = 0) uniform atomic_uint total_pixel_atomic_counter;

layout(location = 0) out vec4 out_color;

uniform usampler2D sampler_occlusion;
uniform ivec3 uniform_resolution;
uniform int uniform_bounces;

flat in int vCurrentLayer;

#define __OCCUPANCY_OPTIMIZATION__

// check for valid voxels
bool checkCRCValidity()
{
	// sample the voxels in the neighborhood of pos
	ivec2 pos = ivec2(floor(gl_FragCoord.xy));

	int lod = 0;
	uint voxel_z = uint(vCurrentLayer);
	
	if (uniform_bounces > 0)
	{
		lod = 2;
		voxel_z = uint(uniform_resolution.z - vCurrentLayer - 1);
	}

	uvec4 voxel1 = texelFetch(sampler_occlusion, pos.xy, lod);	
	uvec4 voxel2 = texelFetch(sampler_occlusion, pos.xy + ivec2(-1, 0), lod);
	uvec4 voxel3 = texelFetch(sampler_occlusion, pos.xy + ivec2(-1, 1), lod);
	uvec4 voxel4 = texelFetch(sampler_occlusion, pos.xy + ivec2(-1,-1), lod);
	uvec4 voxel5 = texelFetch(sampler_occlusion, pos.xy + ivec2( 0, 1), lod);
	uvec4 voxel6 = texelFetch(sampler_occlusion, pos.xy + ivec2( 0,-1), lod);
	uvec4 voxel7 = texelFetch(sampler_occlusion, pos.xy + ivec2( 1, 1), lod);
	uvec4 voxel8 = texelFetch(sampler_occlusion, pos.xy + ivec2( 1, 0), lod);
	uvec4 voxel9 = texelFetch(sampler_occlusion, pos.xy + ivec2( 1,-1), lod);
	
	// merge the sampled voxels
	uvec4 master_voxel = voxel1 | voxel2 | voxel3 | voxel4 | voxel5 | voxel6 | voxel7 | voxel8 | voxel9;
	
	// check if the CRC voxel is valid
	uvec4 slice = master_voxel;
	 
	// get an unsigned vec4 containing the current position (marked as 1)
	uvec4 slicePos = uvec4(0u,0u,0u,0u);
	slicePos[voxel_z / 32u] = 1u << (voxel_z % 32u);

	// use AND to mark whether the current position has been set as occupied
	uvec4 res = slice & slicePos;

	uint prev_voxel_z = (voxel_z == 0u)? 0u : voxel_z - 1u;
	slicePos = uvec4(0u,0u,0u,0u);
	slicePos[prev_voxel_z / 32u] = 1u << (prev_voxel_z % 32u);
	res = res | (slice & slicePos);

	uint next_voxel_z = voxel_z + 1u;
	next_voxel_z = min(uint(uniform_resolution.z), next_voxel_z);
	slicePos = uvec4(0u,0u,0u,0u);
	slicePos[next_voxel_z / 32u] = 1u << (next_voxel_z % 32u);
	res |= (slice & slicePos);

	// check if the current position is marked as occupied
	return ((res.r | res.g | res.b | res.a) > 0u);
}

void main(void)
{	
#ifdef OCCUPANCY_OPTIMIZATION
	float occupancy = 0;

	if (checkCRCValidity()) occupancy = 1.0;

	uint occupied_voxels_atomic_counter_uint = 0;

	if (occupancy > 0.0)
		occupied_voxels_atomic_counter_uint = atomicCounterIncrement(occupied_voxels_atomic_counter);

	out_color = vec4(0,0,0,occupancy);
#else
	uint occupied_voxels_atomic_counter_uint = atomicCounterIncrement(occupied_voxels_atomic_counter);
	out_color = vec4(0,0,0,1);
#endif
}
