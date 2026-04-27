from sentence_transformers import SentenceTransformer

model = None


def get_model():
    global model
    if model is None:
        model = SentenceTransformer('all-MiniLM-L6-v2')
    return model


def get_embeddings(text_list):
    if hasattr(text_list, "astype") and hasattr(text_list, "tolist"):
        text_list = text_list.astype(str).tolist()
    elif isinstance(text_list, str):
        text_list = [text_list]
    else:
        text_list = [str(item) for item in text_list]

    return get_model().encode(text_list)
