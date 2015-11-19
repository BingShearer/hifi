//
//  RenderableParticleEffectEntityItem.h
//  interface/src/entities
//
//  Created by Jason Rickwald on 3/2/15.
//
//  Distributed under the Apache License, Version 2.0.
//  See the accompanying file LICENSE or http://www.apache.org/licenses/LICENSE-2.0.html
//

#ifndef hifi_RenderableParticleEffectEntityItem_h
#define hifi_RenderableParticleEffectEntityItem_h

#include <ParticleEffectEntityItem.h>
#include <TextureCache.h>
#include "RenderableEntityItem.h"

class RenderableParticleEffectEntityItem : public ParticleEffectEntityItem  {
    friend class ParticlePayload;
public:
    static EntityItemPointer factory(const EntityItemID& entityID, const EntityItemProperties& properties);
    RenderableParticleEffectEntityItem(const EntityItemID& entityItemID, const EntityItemProperties& properties);

    virtual void update(const quint64& now) override;

    void updateRenderItem();

    virtual bool addToScene(EntityItemPointer self, render::ScenePointer scene, render::PendingChanges& pendingChanges) override;
    virtual void removeFromScene(EntityItemPointer self, render::ScenePointer scene, render::PendingChanges& pendingChanges) override;

protected:
    struct ParticleUniforms {
        struct {
            float start;
            float middle;
            float finish;
            float spread;
        } radius;
        
        struct {
            glm::vec4 start;
            glm::vec4 middle;
            glm::vec4 finish;
            glm::vec4 spread;
        } color;
        
        float lifespan;
    };
    
    struct ParticlePrimitive {
        ParticlePrimitive(glm::vec3 xyzIn, glm::vec2 uvIn) : xyz(xyzIn), uv(uvIn) {}
        glm::vec3 xyz; // Position
        glm::vec2 uv; // Lifetime + seed
    };
    using ParticlePrimitives = std::vector<ParticlePrimitive>;
    
    void createPipelines();
    
    render::ItemID _renderItemId;
    ParticlePrimitives _particlePrimitives;
    ParticleUniforms _particleUniforms;
    
    gpu::PipelinePointer _untexturedPipeline;
    gpu::PipelinePointer _texturedPipeline;

    render::ScenePointer _scene;
    NetworkTexturePointer _texture;
};


#endif // hifi_RenderableParticleEffectEntityItem_h
