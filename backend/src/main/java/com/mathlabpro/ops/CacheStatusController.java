package com.mathlabpro.ops;

import com.mathlabpro.math.CalculationCacheService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CacheStatusController {

    private final CalculationCacheService calculationCacheService;

    public CacheStatusController(CalculationCacheService calculationCacheService) {
        this.calculationCacheService = calculationCacheService;
    }

    @GetMapping("/api/cache/status")
    public CacheStatusResponse status() {
        return calculationCacheService.status();
    }
}
