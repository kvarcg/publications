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
//#extension GL_EXT_gpu_shader4 : enable
layout(location = 0) in vec3 position;

uniform usampler2D sampler_occupancy;

uniform mat4 uniform_view_proj;
uniform mat4 uniform_scale;

uniform ivec3 uniform_resolution;
uniform vec3 uniform_bbox_min;
uniform vec3 uniform_bbox_max;
uniform int uniform_is_geometry_volume;

out vec4 p_wcs;
flat out int ok;

bool checkCRCValidityOcc(in ivec3 grid_position)
{
	// sample the voxels in the neighborhood of pos
	ivec2 pos = ivec2(grid_position.xy);

	int lod = 2;
	uvec4 voxel1 = texelFetch(sampler_occupancy, pos.xy, lod);	
	uvec4 voxel2 = texelFetch(sampler_occupancy, pos.xy + ivec2(-1, 0), lod);
	uvec4 voxel3 = texelFetch(sampler_occupancy, pos.xy + ivec2(-1, 1), lod);
	uvec4 voxel4 = texelFetch(sampler_occupancy, pos.xy + ivec2(-1,-1), lod);
	uvec4 voxel5 = texelFetch(sampler_occupancy, pos.xy + ivec2( 0, 1), lod);
	uvec4 voxel6 = texelFetch(sampler_occupancy, pos.xy + ivec2( 0,-1), lod);
	uvec4 voxel7 = texelFetch(sampler_occupancy, pos.xy + ivec2( 1, 1), lod);
	uvec4 voxel8 = texelFetch(sampler_occupancy, pos.xy + ivec2( 1, 0), lod);
	uvec4 voxel9 = texelFetch(sampler_occupancy, pos.xy + ivec2( 1,-1), lod);
	
	// merge the sampled voxels
	uvec4 master_voxel = voxel1 | voxel2 | voxel3 | voxel4 | voxel5 | voxel6 | voxel7 | voxel8 | voxel9;
	
	// check if the CRC voxel is valid
	uvec4 slice = master_voxel;
	uint voxel_z = uint(uniform_resolution.z - grid_position.z - 1);

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
	return ((res.r | res.g | res.b | res.a) > 0u) ;
}

bool checkCRCValidityGeo(in ivec3 grid_position)
{
	// sample the voxels in the neighborhood of pos
	ivec2 pos = ivec2(grid_position.xy);

	int lod = 0;
	uvec4 master_voxel = texelFetch(sampler_occupancy, pos.xy, lod);	
	
	// check if the CRC voxel is valid
	uvec4 slice = master_voxel;
	uint voxel_z = uint(uniform_resolution.z - grid_position.z - 1);

	// get an unsigned vec4 containing the current position (marked as 1)
	uvec4 slicePos = uvec4(0u,0u,0u,0u);
	slicePos[voxel_z / 32u] = 1u << (voxel_z % 32u);

	// use AND to mark whether the current position has been set as occupied
	uvec4 res = slice & slicePos;
	
	// check if the current position is marked as occupied
	return ((res.r | res.g | res.b | res.a) > 0u) ;
}

void main(void)
{
	// instanceID 0 - voxels

	// sample from the grid
	ivec3 grid_position;
	grid_position.z = gl_InstanceID / ( uniform_resolution.x * uniform_resolution.y );
	grid_position.y = ( gl_InstanceID / uniform_resolution.x ) % uniform_resolution.y;
	grid_position.x = gl_InstanceID % uniform_resolution.x;

	if (uniform_is_geometry_volume == 0)
		ok = (!checkCRCValidityOcc(grid_position))? 1 : 0;
	else if (uniform_is_geometry_volume == 1)
		ok = (!checkCRCValidityGeo(grid_position))? 1 : 0;

	vec3 stratum = (uniform_bbox_max - uniform_bbox_min) / vec3(uniform_resolution);

	vec3 pos_wcs = vec3(uniform_scale * vec4(position, 1.0)).xyz;
	
	pos_wcs += uniform_bbox_min + (grid_position + 0.5) * stratum;

    gl_Position = uniform_view_proj * vec4(pos_wcs,1);
}
