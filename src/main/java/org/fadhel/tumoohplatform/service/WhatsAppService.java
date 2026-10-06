package org.fadhel.tumoohplatform.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Service
public class WhatsAppService {

    private final RestClient restClient = RestClient.create();

    @Value("${ultramsg.instance-id}")
    private String instanceId;

    @Value("${ultramsg.token}")
    private String token;

    public void sendMessage(String phone, String message) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("token", token);
        form.add("to", phone);
        form.add("body", message);

        restClient.post()
                .uri("https://api.ultramsg.com/" + instanceId + "/messages/chat")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .toBodilessEntity();
    }
}