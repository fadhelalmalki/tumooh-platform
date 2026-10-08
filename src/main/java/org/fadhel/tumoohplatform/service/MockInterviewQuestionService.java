package org.fadhel.tumoohplatform.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.fadhel.tumoohplatform.Api.ApiException;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class MockInterviewQuestionService {

    private static final String CATALOG_PATH = "data/mock-interview-questions.json";
    private static final int QUESTIONS_PER_SESSION = 1;

    private final ObjectMapper objectMapper;

    private Map<String, List<String>> catalog = Map.of();

    @PostConstruct
    void loadCatalog() {
        try (InputStream in = new ClassPathResource(CATALOG_PATH).getInputStream()) {
            catalog = objectMapper.readValue(in, new TypeReference<LinkedHashMap<String, List<String>>>() {});
        } catch (Exception e) {
            log.error("Could not load mock interview question catalog from {}", CATALOG_PATH, e);
            throw new ApiException("Mock interview questions are not configured on the server.");
        }
    }

    public List<String> generateQuestionsForJob(String jobTitle) {
        if (jobTitle == null || jobTitle.isBlank()) {
            throw new ApiException("Job title is required to load interview questions.");
        }

        String trimmed = jobTitle.trim();
        String normalized = normalize(trimmed);

        List<String> exact = catalog.get(normalized);
        if (exact != null && !exact.isEmpty()) {
            return List.copyOf(exact.subList(0, Math.min(QUESTIONS_PER_SESSION, exact.size())));
        }

        List<String> fuzzy = findFuzzyMatch(normalized);
        if (fuzzy != null && !fuzzy.isEmpty()) {
            return List.copyOf(fuzzy.subList(0, Math.min(QUESTIONS_PER_SESSION, fuzzy.size())));
        }

        List<String> templates = catalog.get("_default");
        if (templates == null || templates.isEmpty()) {
            throw new ApiException("No interview questions are defined for this job title.");
        }

        List<String> formatted = new ArrayList<>(QUESTIONS_PER_SESSION);
        for (int i = 0; i < QUESTIONS_PER_SESSION && i < templates.size(); i++) {
            formatted.add(String.format(templates.get(i), trimmed));
        }
        return formatted;
    }

    private List<String> findFuzzyMatch(String normalizedTitle) {
        List<String> best = null;
        int bestLen = 0;
        for (Map.Entry<String, List<String>> entry : catalog.entrySet()) {
            if ("_default".equals(entry.getKey())) {
                continue;
            }
            String key = entry.getKey();
            if (normalizedTitle.contains(key) || key.contains(normalizedTitle)) {
                if (key.length() > bestLen && entry.getValue() != null && !entry.getValue().isEmpty()) {
                    best = entry.getValue();
                    bestLen = key.length();
                }
            }
        }
        return best;
    }

    private static String normalize(String jobTitle) {
        return jobTitle.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }
}
