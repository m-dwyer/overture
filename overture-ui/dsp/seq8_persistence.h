/*
 * SEQ8 persistence helper routines.
 *
 * Included by seq8.c inside the single translation unit. Higher-level
 * save/load routines stay in seq8.c while the state format boundary settles.
 */
#ifndef SEQ8_PERSISTENCE_H
#define SEQ8_PERSISTENCE_H

static int json_get_int(const char *buf, const char *key, int def) {
    char search[64];
    snprintf(search, sizeof(search), "\"%s\":", key);
    const char *p = strstr(buf, search);
    if (!p) return def;
    p += strlen(search);
    while (*p == ' ') p++;
    return my_atoi(p);
}

static uint32_t json_get_uint(const char *buf, const char *key, uint32_t def) {
    char search[64];
    snprintf(search, sizeof(search), "\"%s\":", key);
    const char *p = strstr(buf, search);
    if (!p) return def;
    p += strlen(search);
    while (*p == ' ') p++;
    uint32_t v = 0;
    while (*p >= '0' && *p <= '9') { v = v * 10u + (uint32_t)(*p++ - '0'); }
    return v;
}

static void json_get_steps(const char *buf, const char *key,
                            uint8_t *steps, int n) {
    char search[64];
    snprintf(search, sizeof(search), "\"%s\":\"", key);
    const char *p = strstr(buf, search);
    if (!p) return;
    p += strlen(search);
    int i;
    for (i = 0; i < n && *p && *p != '"'; i++, p++)
        steps[i] = (*p == '1') ? 1 : 0;
}

/* Parse "key":"S:V;S2:V2;..." (V may be signed) into int[count].
 * Entries not present in the sparse string are left unchanged. */
static void json_get_sparse_int(const char *buf, const char *key,
                                int *out, int count) {
    char search[64];
    snprintf(search, sizeof(search), "\"%s\":\"", key);
    const char *p = strstr(buf, search);
    if (!p) return;
    p += strlen(search);
    while (*p && *p != '"') {
        int sidx = 0;
        while (*p >= '0' && *p <= '9') sidx = sidx * 10 + (*p++ - '0');
        if (*p != ':') break;
        p++;
        int sign = 1;
        if (*p == '-') { sign = -1; p++; }
        int val = 0;
        while (*p >= '0' && *p <= '9') val = val * 10 + (*p++ - '0');
        if (sidx >= 0 && sidx < count) out[sidx] = val * sign;
        if (*p == ';') p++;
    }
}

static void ensure_parent_dir(const char *path) {
    char tmp[256];
    char *p;
    snprintf(tmp, sizeof(tmp), "%s", path);
    for (p = tmp + 1; *p; p++) {
        if (*p == '/') {
            *p = '\0';
            mkdir(tmp, 0755);
            *p = '/';
        }
    }
}

/* v=34 per-step trig-condition serialization (iter/random/ratchet).
 * Hex blob, 2 chars per step, exactly cl->length steps. Sparse at the
 * array level; emitted only when any element is non-zero. */
static void write_step_hex_arr(FILE *fp, const char *key,
                               const uint8_t *arr, uint16_t len) {
    int i, any = 0;
    for (i = 0; i < (int)len; i++) if (arr[i]) { any = 1; break; }
    if (!any) return;
    fprintf(fp, ",\"%s\":\"", key);
    for (i = 0; i < (int)len; i++) fprintf(fp, "%02x", (unsigned)arr[i]);
    fputc('"', fp);
}

static void parse_step_hex_arr(const char *buf, const char *key,
                               uint8_t *arr, uint16_t len, int max_val) {
    char search[48];
    snprintf(search, sizeof(search), "\"%s\":\"", key);
    const char *p = strstr(buf, search);
    if (!p) return;
    p += strlen(search);
    int i;
    for (i = 0; i < (int)len && *p && *p != '"'; i++) {
        int hi = -1, lo = -1;
        if (*p >= '0' && *p <= '9') hi = *p - '0';
        else if (*p >= 'a' && *p <= 'f') hi = *p - 'a' + 10;
        else if (*p >= 'A' && *p <= 'F') hi = *p - 'A' + 10;
        if (hi < 0) break;
        p++;
        if (*p >= '0' && *p <= '9') lo = *p - '0';
        else if (*p >= 'a' && *p <= 'f') lo = *p - 'a' + 10;
        else if (*p >= 'A' && *p <= 'F') lo = *p - 'A' + 10;
        if (lo < 0) break;
        p++;
        int v = (hi << 4) | lo;
        if (v > max_val) v = max_val;
        arr[i] = (uint8_t)v;
    }
}

/* Validate iter encoding post-load: 0 OR ((1..8)<<4 | (1..cycle_len)). */
static void sanitize_step_iter_arr(uint8_t *arr, uint16_t len) {
    int i;
    for (i = 0; i < (int)len; i++) {
        uint8_t v = arr[i];
        if (!v) continue;
        int cl = (v >> 4) & 0xF, ci = v & 0xF;
        if (cl < 1 || cl > 8 || ci < 1 || ci > cl) arr[i] = 0;
    }
}

#endif /* SEQ8_PERSISTENCE_H */
