
CREATE POLICY "Anyone can delete chat messages"
ON public.chat_messages
FOR DELETE
USING (true);
