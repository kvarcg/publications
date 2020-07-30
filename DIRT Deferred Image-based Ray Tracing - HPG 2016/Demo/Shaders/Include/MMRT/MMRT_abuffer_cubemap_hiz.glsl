// A Multiview and Multilayer Approach for Interactive Ray Tracing (I3D 2016)
// https://dl.acm.org/citation.cfm?id=2856401
// Authors: K. Vardis, A.A. Vasilakis, G. Papaioannou
// This file contains the code for basic A-buffer routines and per-pixel tracing:
// for min-max hierarhical screen-space ray tracing:
// 1. ray_hit_a_buffer_search - Bucket tracing and skipping

#line 8

// getFirstHead
// Retrieves the head pointer of the first bucket
// Parameters:
// coords - the pixel coordinates to query
// 
// Returns the head pointer
int getFirstHead(ivec2 coords)
{
	for(int b = 0; b < BUCKET_SIZE; ++b)
	{
		if (getPixelHeadID(ivec3(coords, b)) > 0U)
			return b;
	}
	return -1;
}

// isABufferEmpty
// Checks whether there are no fragments stored in the current pixel
// Parameters:
// coords - the pixel coordinates to query
// 
// Returns the head pointer
bool isABufferEmpty(ivec2 coords)
{
	for(int b = 0; b < BUCKET_SIZE; ++b)
	{
		if (getPixelHeadID(ivec3(coords, b)) > 0U)
			return false;
	}
	return true;
}

// ray_hit_a_buffer_search
// Fragment-based intersection tests
// Steps: 
// 1. Check for any intersections with the HiZ texture based on the current lod level
// 	1.1. If there is an intersection, check if we are in the lowest lod level, otherwise return and refine (reduce the lod level)
// 	1.2. If there is an intersection and we are at the lowest lod level continue
// 2. Find the buckets the ray intersects
// 3. Find the direction of traversal and start traversal based on this
// 4. Traverse all intersected buckets in the A-buffer and look for ray-fragment intersection.
// Returns 1 for a valid intersection, otherwise -1
// Parameters:
// coords 		- the pixel coordinates that are traced
// minZ, maxZ 	- the rays Z extents
// increment 	- a scalar value indicating the ray direction. It is positive if the ray is moving in the direction of the camera
// divstep		- conversion factor to the lod we are currenty at
// lod			- the lod the ray is currently at
// cubemapindex - the view index of the ray
// negative towards the camera
// Returns the pointer of a valid intersection, otherwise return a negative value
int ray_hit_a_buffer_search(ivec2 coords, float minZ, float maxZ, int increment, float divstep, int lod, int cubemapindex 
#ifdef LAYER_VISUALIZATION
, out int depth_layer
#endif
)
{
#ifdef STATISTICS
	vec4 val2 = imageLoad(image_ray_test_data, ivec2(gl_FragCoord.xy));
	val2.z++;
	storeDebug(ivec2(gl_FragCoord.xy), vec4(val2));
	int num_layers = 1;
#endif
	// maxZ out of bounds
	if (maxZ >= 0.0) return invalid_result;

	int cube_offset = cubemapindex * BUCKET_SIZE;

	float maxZ_thickness = maxZ + THICKNESS;

	// early skip if out of Z-slice bounds
	ivec2 coords_lod    = ivec2(coords*divstep);
	vec2  depths		= texelFetch(tex_depth_bounds, ivec3(coords_lod, cubemapindex), lod).rg;
	float depth_near	= -depths.r;

#if EARLY_SKIP == 1
	if (minZ >= -depth_near) return invalid_result;
#endif // EARLY_SKIP
		
	float depth_far	= depths.g;	
#if EARLY_SKIP == 1
	if (maxZ_thickness <= -depth_far) return invalid_result;
#endif // EARLY_SKIP

	// if we are inside the current lod
	// but not in the lowest one return and refine
	if(lod > 0) return invalid_lod;

	float	depth_length = depth_near - depth_far;
	int		b0 = (maxZ_thickness >= -depth_near)						  ? 0			   : max(min(int((float(BUCKET_SIZE)*((depth_near + maxZ_thickness) / depth_length))), BUCKET_SIZE_1n),0);
	int		b1 = (b0 == BUCKET_SIZE_1n || minZ <= -depth_far) ? BUCKET_SIZE_1n : max(min(int((float(BUCKET_SIZE)*((depth_near + minZ) / depth_length))), BUCKET_SIZE_1n),0);

#ifdef LAYER_VISUALIZATION
	b0 = 0;
	b1 = BUCKET_SIZE_1n;
	depth_layer = -1;
#endif

#ifndef USE_BUCKETS
	b0 = 0;
	b1 = 0;
#endif

	int	d = max(0, abs(b1 - b0));
	b0 = cube_offset + b0;
	b1 = cube_offset + b1;
	
	// increment is positive if the ray is moving in the direction of the camera, 
	// negative towards the camera (which must flip the search order)
	const bool	reverseZ = increment < 0;
	const int	inc		 = (reverseZ) ? -1 : 1;
			int	b		 = (reverseZ) ? b1 : b0;
			
	uvec2 init_index;
	int	 index_max	= invalid_result;
	float sceneZ;
#ifdef SINGLE_LAYER // single-layer implementation
	int layers = 0;
	b0 = cube_offset;
	b1 = cube_offset + BUCKET_SIZE_1n;
	for(int i=b0; i <= b1 && layers < NUM_LAYERS; i++)
	{
		init_index[0] = getPixelHeadID(ivec3(coords, i));
		if(init_index[0] == 0U)	continue;
		
		uint index = init_index.x;
		
		// single view test
		while(index != 0U && index_max <= 0 && layers < NUM_LAYERS)
		{
			if (nodes[index].depth <= maxZ_thickness && nodes[index].depth > minZ)
			{
				index_max = int(index);
			}
			index	= nodes[index].next;
			++layers;
		}
	}
#else // multi-layer implementation			
	for(int i=0; i <= d && index_max <= 0; i++, b += inc)
	{
		init_index[0] = getPixelHeadID(ivec3(coords, b));
		if(init_index[0] == 0U)	continue;

		init_index[1] = (reverseZ) ? getPixelTailID(ivec3(coords, b)) : 0U;

		uint index;

		if(reverseZ)
		{
			index = init_index.y;
			while(index != 0U && index_max < 0)
			{
				NodeTypeLL_Double node = nodes[index];

				if (node.depth <= maxZ_thickness && node.depth > minZ)
					index_max = int(index);
				index	= node.prev;
#ifdef LAYER_VISUALIZATION
				depth_layer++;
#endif
#ifdef STATISTICS
				num_layers++;
#endif
			}
#ifdef LAYER_VISUALIZATION
			if (index_max > invalid_result)
			{
				int total = -1;
				for(int v=0; v < BUCKET_SIZE; v++)
				{
					index = getPixelHeadID(ivec3(coords, v));
					if(index <= 0U)	continue;
					while(index!= 0U)
					{
						index	= nodes[index].next;
						++total;
					}
				}
				depth_layer = total - depth_layer;
			}
#endif // LAYER_VISUALIZATION
		}
		else
		{
			index = init_index.x;
			while(index != 0U && index_max < 0)
			{
				NodeTypeLL_Double node = nodes[index];
				if (node.depth <= maxZ_thickness && node.depth > minZ)
					index_max = int(index);
				index	= node.next;
#ifdef LAYER_VISUALIZATION
				depth_layer++;
#endif
#ifdef STATISTICS
				num_layers++;
#endif
			}
		}

	}
#endif // SINGLE_LAYER

#ifdef STATISTICS
	float total_samples = 1;
	vec4 val = loadDebug(ivec2(gl_FragCoord.xy));
	total_samples += val.w;
	float avg_layers = num_layers + val.x * val.w;
	avg_layers /= total_samples;
	val.x = avg_layers;
	val.w = total_samples;
	storeDebug(ivec2(gl_FragCoord.xy), val);
#endif

	return index_max;
}