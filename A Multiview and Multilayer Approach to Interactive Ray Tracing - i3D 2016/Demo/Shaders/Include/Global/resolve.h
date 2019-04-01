// ok
uniform int	uniform_layer;
//	uniform int	uniform_target;

vec4 resolveLayer(const int num)
{
	return unpackUnorm4x8(floatBitsToUint(fragments[uniform_layer].r));

	// 4. RETURN -- SLOW
	//if		(target == DEPTH_BINDING)	return vec4(depths[uniform_layer].g);
	//else if (target == COLOR_BINDING)	return unpackUnorm4x8(colors[int(depths[uniform_layer].r)]);
	//else if (target == NORMAL_BINDING)	return vec4(unpackUnorm2x16(normals[int(depths[uniform_layer].r)]), 0.0f, 1.0f);
	//else								return vec4(num / float(ABUFFER_SIZE));
}

vec4 resolve(const int num)
{
	//if(layer+1 > num)
		//discard;

	sort(num);
	return resolveLayer(num);
}